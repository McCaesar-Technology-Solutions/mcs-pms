-- Reservation lifecycle v2: expanded statuses, event log, holds, hotel settings.

-- ---------------------------------------------------------------------------
-- Hotel reservation settings
-- ---------------------------------------------------------------------------
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS hold_duration_online_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS hold_duration_phone_minutes integer NOT NULL DEFAULT 240,
  ADD COLUMN IF NOT EXISTS hold_duration_agent_minutes integer NOT NULL DEFAULT 1440,
  ADD COLUMN IF NOT EXISTS no_show_time time NOT NULL DEFAULT '23:59',
  ADD COLUMN IF NOT EXISTS post_stay_archive_delay_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS no_show_charge_policy text NOT NULL DEFAULT 'one_night',
  ADD COLUMN IF NOT EXISTS no_show_hold_room boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_free_cancel_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS default_refundable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_penalty_nights integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS use_lifecycle_v2 boolean NOT NULL DEFAULT false;

ALTER TABLE hotels DROP CONSTRAINT IF EXISTS hotels_no_show_charge_policy_check;
ALTER TABLE hotels ADD CONSTRAINT hotels_no_show_charge_policy_check CHECK (
  no_show_charge_policy IN ('none', 'one_night', 'full_stay')
);

-- ---------------------------------------------------------------------------
-- Reservation lifecycle columns
-- ---------------------------------------------------------------------------
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS folio_locked boolean NOT NULL DEFAULT false;

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (
  status IN (
    'inquiry',
    'provisional',
    'confirmed',
    'pre_arrival',
    'checked_in',
    'checkout_in_progress',
    'checked_out',
    'post_stay',
    'archived',
    'no_show',
    'cancelled',
    'released',
    'dispute_hold',
    'overstay',
    'walkout'
  )
);

-- Existing rows keep their status values (subset of new enum).

-- ---------------------------------------------------------------------------
-- reservation_events (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_id uuid,
  actor_role text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_events_reservation_created
  ON reservation_events (reservation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reservation_events_hotel_created
  ON reservation_events (hotel_id, created_at);

ALTER TABLE reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_reservation_events" ON reservation_events
  FOR SELECT
  USING (hotel_id = auth_hotel_id());

CREATE POLICY "service_manage_reservation_events" ON reservation_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- reservation_holds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservation_holds (
  reservation_id uuid PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  hold_source text NOT NULL CHECK (hold_source IN ('online', 'phone', 'agent')),
  released_at timestamptz
);

ALTER TABLE reservation_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_reservation_holds" ON reservation_holds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = reservation_holds.reservation_id
        AND r.hotel_id = auth_hotel_id()
    )
  );

CREATE POLICY "service_manage_reservation_holds" ON reservation_holds
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Atomic status transition (SELECT FOR UPDATE + event + optional room/hold)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION transition_reservation_status(
  p_reservation_id uuid,
  p_hotel_id uuid,
  p_to_status text,
  p_event_type text,
  p_actor_id uuid DEFAULT NULL,
  p_actor_role text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_room_status text DEFAULT NULL,
  p_room_updated_by uuid DEFAULT NULL,
  p_hold_source text DEFAULT NULL,
  p_hold_minutes integer DEFAULT NULL,
  p_expected_from text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row reservations%ROWTYPE;
  v_from text;
  v_event_id uuid;
  v_now timestamptz := now();
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_row
  FROM reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'error', 'Reservation not found.');
  END IF;

  IF v_row.hotel_id IS DISTINCT FROM p_hotel_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'HOTEL_MISMATCH', 'error', 'Hotel mismatch.');
  END IF;

  v_from := v_row.status;

  IF v_from = p_to_status THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'from_status', v_from, 'to_status', p_to_status);
  END IF;

  IF p_expected_from IS NOT NULL AND v_from IS DISTINCT FROM p_expected_from THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONCURRENT_MODIFICATION',
      'error', 'Reservation status changed. Retry the action.',
      'from_status', v_from
    );
  END IF;

  UPDATE reservations
  SET
    status = p_to_status,
    checked_in_at = CASE
      WHEN p_to_status = 'checked_in' AND checked_in_at IS NULL THEN v_now
      ELSE checked_in_at
    END,
    checked_out_at = CASE
      WHEN p_to_status IN ('checked_out', 'walkout') THEN v_now
      ELSE checked_out_at
    END,
    folio_locked = CASE
      WHEN p_to_status = 'checkout_in_progress' THEN true
      WHEN p_to_status IN ('checked_out', 'post_stay', 'archived', 'walkout') THEN false
      ELSE folio_locked
    END
  WHERE id = p_reservation_id;

  INSERT INTO reservation_events (
    reservation_id,
    hotel_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    actor_role,
    payload
  )
  VALUES (
    p_reservation_id,
    p_hotel_id,
    p_event_type,
    v_from,
    p_to_status,
    p_actor_id,
    p_actor_role,
    p_payload
  )
  RETURNING id INTO v_event_id;

  IF p_to_status = 'provisional' AND p_hold_source IS NOT NULL AND p_hold_minutes IS NOT NULL THEN
    v_expires := v_now + make_interval(mins => p_hold_minutes);
    INSERT INTO reservation_holds (reservation_id, expires_at, hold_source)
    VALUES (p_reservation_id, v_expires, p_hold_source)
    ON CONFLICT (reservation_id) DO UPDATE
      SET expires_at = EXCLUDED.expires_at,
          hold_source = EXCLUDED.hold_source,
          released_at = NULL;
  END IF;

  IF p_to_status IN ('confirmed', 'released', 'cancelled', 'no_show') THEN
    UPDATE reservation_holds
    SET released_at = COALESCE(released_at, v_now)
    WHERE reservation_id = p_reservation_id
      AND released_at IS NULL;
  END IF;

  IF p_room_status IS NOT NULL AND v_row.room_id IS NOT NULL THEN
    UPDATE rooms
    SET status = p_room_status,
        updated_by = COALESCE(p_room_updated_by, updated_by),
        updated_at = v_now
    WHERE id = v_row.room_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'from_status', v_from,
    'to_status', p_to_status
  );
EXCEPTION
  WHEN check_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATUS',
      'error', 'Status value not allowed.'
    );
END;
$$;

REVOKE ALL ON FUNCTION transition_reservation_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_reservation_status TO service_role;

COMMENT ON TABLE reservation_events IS 'Append-only reservation lifecycle audit trail.';
COMMENT ON TABLE reservation_holds IS 'Provisional booking hold timers.';

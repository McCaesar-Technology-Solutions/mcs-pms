-- Prevent double-booking at the database level.
--
-- The application checks for room clashes before inserting a reservation, but two
-- staff acting at the same time can both pass that check (TOCTOU) and create
-- overlapping bookings for the same room. This adds a hard guarantee: Postgres
-- rejects any second reservation whose date range overlaps an existing
-- inventory-blocking reservation for the same room.
--
-- Date semantics match the app: check_in/check_out are half-open `[)`, so
-- same-day turnover (one guest checks out the morning another checks in) is
-- allowed and does NOT count as an overlap.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- If legacy overlapping rows exist in blocking statuses, adding this constraint
-- will fail. Find them with:
--   SELECT a.id, b.id, a.room_id
--   FROM reservations a JOIN reservations b
--     ON a.room_id = b.room_id AND a.id < b.id
--    AND daterange(a.check_in, a.check_out, '[)') && daterange(b.check_in, b.check_out, '[)')
--   WHERE a.status IN ('provisional','confirmed','pre_arrival','checked_in','checkout_in_progress')
--     AND b.status IN ('provisional','confirmed','pre_arrival','checked_in','checkout_in_progress');

ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_no_double_booking;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_no_double_booking
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (
    room_id IS NOT NULL
    AND status IN (
      'provisional',
      'confirmed',
      'pre_arrival',
      'checked_in',
      'checkout_in_progress'
    )
  );

COMMENT ON CONSTRAINT reservations_no_double_booking ON reservations IS
  'Blocks overlapping reservations for the same room while a booking holds inventory.';

-- ---------------------------------------------------------------------------
-- Teach the atomic transition RPC to report the conflict cleanly instead of
-- surfacing a raw Postgres exclusion_violation. Body is identical to migration
-- 051 aside from the added exception branch.
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
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ROOM_CONFLICT',
      'error', 'That room was just booked for these dates. Pick another room.'
    );
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

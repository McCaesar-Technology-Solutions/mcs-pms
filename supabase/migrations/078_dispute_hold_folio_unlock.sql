-- Folio stays locked only during checkout. Dispute hold (and returning to
-- in-house / overstay) unlocks so charges can still be posted.

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
    folio_locked = (p_to_status = 'checkout_in_progress')
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

-- Per-property guest portal rules & regulations (QR join gate + portal acceptance).

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS guest_rules_version integer NOT NULL DEFAULT 1;

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS guest_rules_accepted_version integer;

CREATE TABLE IF NOT EXISTS hotel_guest_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  rule_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hotel_guest_rules_text_nonempty CHECK (char_length(btrim(rule_text)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_hotel_guest_rules_hotel_sort
  ON hotel_guest_rules (hotel_id, sort_order ASC, created_at ASC);

ALTER TABLE hotel_guest_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read_hotel_guest_rules ON hotel_guest_rules
  FOR SELECT
  USING (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE AND p.hotel_id IS NOT NULL
    )
    OR hotel_id IN (
      SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid()
    )
  );

CREATE POLICY staff_manage_hotel_guest_rules ON hotel_guest_rules
  FOR ALL
  USING (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('owner', 'manager')
        AND p.hotel_id IS NOT NULL
    )
    OR hotel_id IN (
      SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('owner', 'manager')
        AND p.hotel_id IS NOT NULL
    )
    OR hotel_id IN (
      SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE hotel_guest_rules IS
  'Guest-facing rules shown before portal access (QR join flow).';
COMMENT ON COLUMN hotels.guest_rules_version IS
  'Incremented when rules change; guests must re-accept.';
COMMENT ON COLUMN guests.guest_rules_accepted_version IS
  'Last guest_rules_version the guest agreed to for this stay.';

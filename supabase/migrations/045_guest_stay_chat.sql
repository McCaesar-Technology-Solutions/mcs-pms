-- Stay-level guest ↔ front desk chat (one thread per in-house guest)

CREATE TABLE IF NOT EXISTS guest_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  staff_last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id)
);

CREATE TABLE IF NOT EXISTS guest_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES guest_conversations(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('guest', 'staff')),
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_conversation_messages_body_nonempty CHECK (char_length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_guest_conversations_hotel_updated
  ON guest_conversations (hotel_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_guest_conversation_messages_conv_created
  ON guest_conversation_messages (conversation_id, created_at ASC);

ALTER TABLE guest_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_read_guest_conversations ON guest_conversations
  FOR SELECT USING (
    hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_update_guest_conversations ON guest_conversations
  FOR UPDATE USING (
    hotel_id IN (
      SELECT p.hotel_id FROM profiles p
      WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE
        AND p.role IN ('owner', 'manager', 'receptionist')
    )
    OR hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
  );

CREATE POLICY staff_read_guest_conversation_messages ON guest_conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guest_conversations gc
      WHERE gc.id = guest_conversation_messages.conversation_id
        AND (
          gc.hotel_id IN (SELECT p.hotel_id FROM profiles p WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE)
          OR gc.hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
        )
    )
  );

CREATE POLICY staff_insert_guest_conversation_messages ON guest_conversation_messages
  FOR INSERT WITH CHECK (
    author_role = 'staff'
    AND EXISTS (
      SELECT 1 FROM guest_conversations gc
      WHERE gc.id = guest_conversation_messages.conversation_id
        AND (
          gc.hotel_id IN (
            SELECT p.hotel_id FROM profiles p
            WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE
              AND p.role IN ('owner', 'manager', 'receptionist')
          )
          OR gc.hotel_id IN (SELECT h.id FROM hotels h WHERE h.owner_id = auth.uid())
        )
    )
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE guest_conversation_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE guest_conversation_messages REPLICA IDENTITY FULL;

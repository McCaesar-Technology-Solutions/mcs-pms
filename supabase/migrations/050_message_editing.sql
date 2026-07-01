ALTER TABLE staff_conversation_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE guest_conversation_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE complaint_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE guest_conversations
  ADD COLUMN IF NOT EXISTS guest_last_read_at timestamptz;

ALTER TABLE complaints
  ADD COLUMN IF NOT EXISTS guest_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS staff_last_read_at timestamptz;

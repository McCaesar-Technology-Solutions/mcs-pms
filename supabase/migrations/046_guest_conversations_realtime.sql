-- Realtime for guest_conversations (read-state / updated_at) so message badges clear live.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE guest_conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE guest_conversations REPLICA IDENTITY FULL;

-- Owners may read all staff conversations at their hotel (oversight / audit).
-- Write access remains membership-only via server actions.

CREATE POLICY staff_conv_owner_read ON staff_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'owner'
        AND p.hotel_id = staff_conversations.hotel_id
    )
  );

CREATE POLICY staff_conv_members_owner_read ON staff_conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN staff_conversations sc ON sc.id = staff_conversation_members.conversation_id
      WHERE p.id = auth.uid()
        AND p.role = 'owner'
        AND p.hotel_id = sc.hotel_id
    )
  );

CREATE POLICY staff_conv_messages_owner_read ON staff_conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN staff_conversations sc ON sc.id = staff_conversation_messages.conversation_id
      WHERE p.id = auth.uid()
        AND p.role = 'owner'
        AND p.hotel_id = sc.hotel_id
    )
  );

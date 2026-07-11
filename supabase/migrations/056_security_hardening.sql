-- Security hardening: close profile privilege escalation and conversation self-join vectors.

-- Profile updates must go through server actions (service role). Client-side UPDATE
-- allowed changing role, hotel_id, and MFA flags via the browser Supabase client.
DROP POLICY IF EXISTS "staff_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "owner_update_own_profile" ON profiles;

-- Staff conversation membership is managed by server actions (service role).
-- The previous FOR ALL policy let any user insert themselves into any conversation.
DROP POLICY IF EXISTS staff_conv_members_self ON staff_conversation_members;

-- Members may read their own membership rows (e.g. for future client reads).
CREATE POLICY staff_conv_members_select_own ON staff_conversation_members
  FOR SELECT USING (profile_id = auth.uid());

-- Members may update only their own read cursor.
CREATE POLICY staff_conv_members_update_own ON staff_conversation_members
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

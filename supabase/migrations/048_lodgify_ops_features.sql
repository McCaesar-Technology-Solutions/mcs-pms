-- Room photos, expenses, inventory, staff team chat, ops calendar

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS profile_image_path text;

COMMENT ON COLUMN rooms.profile_image_path IS 'Storage path in property-images bucket for room thumbnail';

-- Expenses (owner ledger)
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending', 'paid')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_hotel_date ON expenses (hotel_id, expense_date DESC);

-- Inventory min-stock
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  quantity_in_stock integer NOT NULL DEFAULT 0 CHECK (quantity_in_stock >= 0),
  reorder_level integer NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  unit text NOT NULL DEFAULT 'unit',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_hotel ON inventory_items (hotel_id, name);

-- Staff team messaging (DM + group)
CREATE TABLE IF NOT EXISTS staff_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  conversation_type text NOT NULL CHECK (conversation_type IN ('dm', 'group')),
  name text,
  dm_key text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_conversations_group_name CHECK (
    conversation_type = 'dm' OR (name IS NOT NULL AND char_length(btrim(name)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_conversations_dm_key
  ON staff_conversations (hotel_id, dm_key)
  WHERE dm_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_conversations_hotel_updated
  ON staff_conversations (hotel_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS staff_conversation_members (
  conversation_id uuid NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_conv_members_profile
  ON staff_conversation_members (profile_id);

CREATE TABLE IF NOT EXISTS staff_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES staff_conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_conversation_messages_body_nonempty CHECK (char_length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_staff_conv_messages_conv_created
  ON staff_conversation_messages (conversation_id, created_at ASC);

-- Ops calendar (internal events)
CREATE TABLE IF NOT EXISTS ops_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN (
    'training', 'meeting', 'guest_service', 'maintenance', 'event', 'general'
  )),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_calendar_hotel_starts
  ON ops_calendar_events (hotel_id, starts_at);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY expenses_owner ON expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
        AND p.hotel_id = expenses.hotel_id
    )
  );

CREATE POLICY inventory_staff ON inventory_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = inventory_items.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
    )
  );

CREATE POLICY staff_conv_read ON staff_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_conversation_members m
      WHERE m.conversation_id = staff_conversations.id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY staff_conv_insert ON staff_conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = staff_conversations.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist', 'technician')
    )
  );

CREATE POLICY staff_conv_update ON staff_conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff_conversation_members m
      WHERE m.conversation_id = staff_conversations.id AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY staff_conv_members_self ON staff_conversation_members
  FOR ALL USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM staff_conversations sc
      WHERE sc.id = staff_conversation_members.conversation_id
        AND sc.created_by = auth.uid()
    )
  );

CREATE POLICY staff_conv_messages_read ON staff_conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_conversation_members m
      WHERE m.conversation_id = staff_conversation_messages.conversation_id
        AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY staff_conv_messages_insert ON staff_conversation_messages
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM staff_conversation_members m
      WHERE m.conversation_id = staff_conversation_messages.conversation_id
        AND m.profile_id = auth.uid()
    )
  );

CREATE POLICY ops_calendar_staff ON ops_calendar_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.hotel_id = ops_calendar_events.hotel_id
        AND p.role IN ('owner', 'manager', 'receptionist')
    )
  );

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE staff_conversation_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE staff_conversation_messages REPLICA IDENTITY FULL;

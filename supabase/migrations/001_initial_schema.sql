-- Hotels
CREATE TABLE hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  gta_license_number text,
  gta_license_expiry date,
  vat_registration_number text,
  created_at timestamptz DEFAULT now()
);

-- Profiles (linked to auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  hotel_id uuid REFERENCES hotels,
  role text NOT NULL CHECK (role IN ('owner','manager','technician')),
  name text NOT NULL,
  email text NOT NULL,
  specialty text,
  invited_by uuid REFERENCES profiles,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Rooms
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  number text NOT NULL,
  floor int,
  type text CHECK (type IN ('standard','deluxe','suite')),
  status text DEFAULT 'available' CHECK (status IN (
    'available','occupied','maintenance',
    'needs_inspection','cleaning'
  )),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles,
  UNIQUE (hotel_id, number)
);

-- Guests (NOT Supabase Auth users — token-based)
CREATE TABLE guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  room_id uuid REFERENCES rooms,
  name text NOT NULL,
  email text,
  phone text,
  ghana_card_number text,
  token uuid UNIQUE DEFAULT gen_random_uuid(),
  token_expires_at timestamptz,
  check_in date,
  check_out date,
  enrolled_by uuid REFERENCES profiles,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_guests_token ON guests (token);

-- Reservations
CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  room_id uuid REFERENCES rooms,
  guest_id uuid REFERENCES guests,
  guest_name text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  status text DEFAULT 'confirmed' CHECK (status IN (
    'confirmed','checked_in','checked_out','cancelled'
  )),
  channel text CHECK (channel IN (
    'airbnb','booking_com','direct','walk_in','other'
  )),
  nightly_rate numeric(10,2),
  total_amount numeric(10,2),
  created_by uuid REFERENCES profiles,
  created_at timestamptz DEFAULT now()
);

-- Complaints
CREATE TABLE complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  room_id uuid REFERENCES rooms,
  guest_id uuid REFERENCES guests,
  category text NOT NULL CHECK (category IN (
    'plumbing','electrical','hvac',
    'furniture','cleaning','noise','other'
  )),
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (
    priority IN ('low','medium','high','urgent')
  ),
  status text DEFAULT 'open' CHECK (status IN (
    'open','assigned','in_progress',
    'pending_approval','rejected','resolved'
  )),
  assigned_to uuid REFERENCES profiles,
  rejection_note text,
  submitted_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Complaint timeline
CREATE TABLE complaint_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles,
  actor_role text,
  event_type text NOT NULL CHECK (event_type IN (
    'submitted','assigned','started',
    'completion_requested','rejected','resolved'
  )),
  note text,
  created_at timestamptz DEFAULT now()
);

-- Invoices
CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  reservation_id uuid REFERENCES reservations,
  guest_id uuid REFERENCES guests,
  guest_name text NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  vat_amount numeric(10,2),
  nhil_amount numeric(10,2),
  getfund_amount numeric(10,2),
  covid_levy_amount numeric(10,2),
  elevy_amount numeric(10,2),
  total_amount numeric(10,2) NOT NULL,
  payment_method text CHECK (payment_method IN (
    'mtn_momo','telecel_cash','airteltigo',
    'visa','mastercard','cash','bank_transfer'
  )),
  payment_status text DEFAULT 'pending' CHECK (
    payment_status IN ('pending','paid','overdue','refunded')
  ),
  issued_at timestamptz DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz
);

-- Staff invites
CREATE TABLE staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager','technician')),
  invited_by uuid REFERENCES profiles,
  token uuid UNIQUE DEFAULT gen_random_uuid(),
  accepted bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE complaints;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

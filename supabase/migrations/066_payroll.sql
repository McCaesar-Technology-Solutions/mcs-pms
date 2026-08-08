-- Payroll: compensation profiles, pay periods/runs, commissions, settings.
-- Ghana-first ops payroll; guest GRA tax remains separate.

-- ---------------------------------------------------------------------------
-- Audit entity
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (
  entity_type IN (
    'reservation',
    'room',
    'room_category',
    'hotel',
    'staff',
    'guest',
    'invoice',
    'complaint',
    'guest_request',
    'payment',
    'access',
    'payroll'
  )
);

-- ---------------------------------------------------------------------------
-- Payroll settings (one row per hotel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  default_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (default_cycle IN ('monthly', 'biweekly', 'weekly')),
  post_expense_on_paid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_settings_hotel_unique UNIQUE (hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_settings_hotel ON payroll_settings (hotel_id);

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY payroll_settings_owner_manager_select ON payroll_settings
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY payroll_settings_owner_write ON payroll_settings
  FOR ALL
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Employee compensation (1:1 with profiles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pay_type text NOT NULL DEFAULT 'salary'
    CHECK (pay_type IN ('salary', 'daily', 'hourly')),
  base_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  currency text NOT NULL DEFAULT 'GHS',
  momo_number text,
  bank_name text,
  bank_account text,
  tin text,
  ssnit_number text,
  hire_date date,
  payroll_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_compensation_profile_unique UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_compensation_hotel
  ON employee_compensation (hotel_id);

CREATE INDEX IF NOT EXISTS idx_employee_compensation_hotel_active
  ON employee_compensation (hotel_id, payroll_active);

ALTER TABLE employee_compensation ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_compensation_owner_manager_select ON employee_compensation
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY employee_compensation_owner_write ON employee_compensation
  FOR ALL
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Pay periods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pay_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  cycle text NOT NULL DEFAULT 'monthly'
    CHECK (cycle IN ('monthly', 'biweekly', 'weekly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pay_periods_range_check CHECK (period_end >= period_start),
  CONSTRAINT pay_periods_hotel_range_unique UNIQUE (hotel_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_pay_periods_hotel_start
  ON pay_periods (hotel_id, period_start DESC);

ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY pay_periods_owner_manager_select ON pay_periods
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_periods_owner_manager_insert ON pay_periods
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_periods_owner_manager_update ON pay_periods
  FOR UPDATE
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_periods_owner_delete ON pay_periods
  FOR DELETE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Pay runs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pay_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  pay_period_id uuid NOT NULL REFERENCES pay_periods(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'paid', 'void')),
  total_base numeric(12, 2) NOT NULL DEFAULT 0,
  total_commission numeric(12, 2) NOT NULL DEFAULT 0,
  total_allowances numeric(12, 2) NOT NULL DEFAULT 0,
  total_deductions numeric(12, 2) NOT NULL DEFAULT 0,
  total_net numeric(12, 2) NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  paid_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  paid_at timestamptz,
  expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pay_runs_period_unique UNIQUE (pay_period_id)
);

CREATE INDEX IF NOT EXISTS idx_pay_runs_hotel_status
  ON pay_runs (hotel_id, status);

CREATE INDEX IF NOT EXISTS idx_pay_runs_hotel_created
  ON pay_runs (hotel_id, created_at DESC);

ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY pay_runs_owner_manager_select ON pay_runs
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_runs_owner_manager_insert ON pay_runs
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

-- Managers may only touch draft / pending_approval runs (not approve or mark paid)
CREATE POLICY pay_runs_manager_update_draft ON pay_runs
  FOR UPDATE
  USING (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
    AND status IN ('draft', 'pending_approval')
  )
  WITH CHECK (
    auth_role() = 'manager'
    AND hotel_id = auth_hotel_id()
    AND status IN ('draft', 'pending_approval')
  );

CREATE POLICY pay_runs_owner_update ON pay_runs
  FOR UPDATE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_runs_owner_delete ON pay_runs
  FOR DELETE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Pay run lines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pay_run_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  pay_run_id uuid NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  base_pay numeric(12, 2) NOT NULL DEFAULT 0 CHECK (base_pay >= 0),
  commission numeric(12, 2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
  allowances numeric(12, 2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  deductions numeric(12, 2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  net_pay numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'paid', 'excluded')),
  override_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pay_run_lines_run_profile_unique UNIQUE (pay_run_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_pay_run_lines_run ON pay_run_lines (pay_run_id);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_hotel_profile
  ON pay_run_lines (hotel_id, profile_id);

ALTER TABLE pay_run_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY pay_run_lines_owner_manager_select ON pay_run_lines
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_run_lines_owner_manager_insert ON pay_run_lines
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

-- Line amount edits: owner only. Managers insert lines when generating drafts.
CREATE POLICY pay_run_lines_owner_update ON pay_run_lines
  FOR UPDATE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY pay_run_lines_owner_delete ON pay_run_lines
  FOR DELETE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Commission rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Housekeeping clean',
  trigger text NOT NULL DEFAULT 'housekeeping_complete'
    CHECK (trigger IN ('housekeeping_complete', 'manual')),
  rate_type text NOT NULL DEFAULT 'flat'
    CHECK (rate_type IN ('flat', 'percent')),
  rate_value numeric(12, 2) NOT NULL DEFAULT 0 CHECK (rate_value >= 0),
  -- When rate_type = percent, commission = rate_value% of percent_base_amount
  percent_base_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (percent_base_amount >= 0),
  task_type text DEFAULT 'clean'
    CHECK (task_type IS NULL OR task_type IN ('clean', 'inspect', 'maintenance', 'restock')),
  role_filter text
    CHECK (
      role_filter IS NULL
      OR role_filter IN ('manager', 'technician', 'receptionist')
    ),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_hotel_active
  ON commission_rules (hotel_id, active);

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_rules_owner_manager_select ON commission_rules
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY commission_rules_owner_write ON commission_rules
  FOR ALL
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

-- ---------------------------------------------------------------------------
-- Commission entries (accruals)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES commission_rules(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'housekeeping_task'
    CHECK (source_type IN ('housekeeping_task', 'manual')),
  source_id uuid,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  accrued_on date NOT NULL DEFAULT CURRENT_DATE,
  pay_period_id uuid REFERENCES pay_periods(id) ON DELETE SET NULL,
  pay_run_line_id uuid REFERENCES pay_run_lines(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'accrued'
    CHECK (status IN ('accrued', 'included', 'void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_entries_hotel_status
  ON commission_entries (hotel_id, status, accrued_on);

CREATE INDEX IF NOT EXISTS idx_commission_entries_profile
  ON commission_entries (hotel_id, profile_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_entries_source_unique
  ON commission_entries (hotel_id, source_type, source_id, rule_id)
  WHERE source_id IS NOT NULL AND rule_id IS NOT NULL AND status <> 'void';

ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY commission_entries_owner_manager_select ON commission_entries
  FOR SELECT
  USING (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY commission_entries_owner_manager_insert ON commission_entries
  FOR INSERT
  WITH CHECK (
    auth_role() IN ('owner', 'manager')
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY commission_entries_owner_update ON commission_entries
  FOR UPDATE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  )
  WITH CHECK (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

CREATE POLICY commission_entries_owner_delete ON commission_entries
  FOR DELETE
  USING (
    auth_role() = 'owner'
    AND hotel_id = auth_hotel_id()
  );

COMMENT ON TABLE employee_compensation IS
  'Staff pay profiles (rates, bank/MoMo, TIN/SSNIT). Separate from guest access employee_no.';
COMMENT ON TABLE pay_runs IS
  'Payroll run lifecycle: draft → pending_approval → approved → paid (immutable when paid).';
COMMENT ON TABLE commission_entries IS
  'Accrued commission units from housekeeping (or manual) awaiting inclusion in a pay run.';

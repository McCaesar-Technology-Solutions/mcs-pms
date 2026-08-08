-- Harden payroll RLS: managers cannot approve/mark-paid or edit line amounts via PostgREST.
-- Safe to re-run after 066 (drops legacy broad update policies if present).

-- pay_runs
DROP POLICY IF EXISTS pay_runs_owner_manager_update ON pay_runs;
DROP POLICY IF EXISTS pay_runs_manager_update_draft ON pay_runs;
DROP POLICY IF EXISTS pay_runs_owner_update ON pay_runs;

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

-- pay_run_lines
DROP POLICY IF EXISTS pay_run_lines_owner_manager_update ON pay_run_lines;
DROP POLICY IF EXISTS pay_run_lines_owner_update ON pay_run_lines;

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

-- commission_entries: managers may insert accruals; only owners update/void via client
DROP POLICY IF EXISTS commission_entries_owner_manager_update ON commission_entries;
DROP POLICY IF EXISTS commission_entries_owner_update ON commission_entries;

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

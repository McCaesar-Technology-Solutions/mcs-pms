import { createAdminClient } from '@/lib/supabase/admin'
import { resolveHotelTenantAccess } from '@/lib/data/tenant-guard'
import { defaultPeriodBounds, formatPeriodLabel, roundMoney } from '@/lib/payroll/calculate'
import type {
  CommissionEntryRow,
  CommissionRuleRow,
  EmployeeCompensationRow,
  PayPeriodRow,
  PayrollOverviewData,
  PayrollSettingsRow,
  PayRunLineRow,
  PayRunRow,
} from '@/lib/payroll/types'
import type { UserRole } from '@/types'

function mapCompensation(
  row: {
    id: string
    hotel_id: string
    profile_id: string
    pay_type: string
    base_amount: number
    currency: string
    momo_number: string | null
    bank_name: string | null
    bank_account: string | null
    tin: string | null
    ssnit_number: string | null
    hire_date: string | null
    payroll_active: boolean
    notes: string | null
  },
  profile?: {
    name: string
    role: UserRole
    specialty: string | null
    email: string
    is_active: boolean | null
    profile_image_path: string | null
  },
): EmployeeCompensationRow {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    profileId: row.profile_id,
    payType: row.pay_type as EmployeeCompensationRow['payType'],
    baseAmount: Number(row.base_amount),
    currency: row.currency,
    momoNumber: row.momo_number,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    tin: row.tin,
    ssnitNumber: row.ssnit_number,
    hireDate: row.hire_date,
    payrollActive: row.payroll_active,
    notes: row.notes,
    staffName: profile?.name,
    staffRole: profile?.role,
    staffSpecialty: profile?.specialty,
    staffEmail: profile?.email,
    staffActive: profile?.is_active !== false,
    profileImagePath: profile?.profile_image_path ?? null,
  }
}

function mapPeriod(row: {
  id: string
  hotel_id: string
  cycle: string
  period_start: string
  period_end: string
  status: string
}): PayPeriodRow {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    cycle: row.cycle as PayPeriodRow['cycle'],
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status as PayPeriodRow['status'],
  }
}

function mapRun(
  row: {
    id: string
    hotel_id: string
    pay_period_id: string
    status: string
    total_base: number
    total_commission: number
    total_allowances: number
    total_deductions: number
    total_net: number
    employee_count: number
    notes: string | null
    approved_at: string | null
    paid_at: string | null
    expense_id: string | null
  },
  period?: { period_start: string; period_end: string; cycle: string },
): PayRunRow {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    payPeriodId: row.pay_period_id,
    status: row.status as PayRunRow['status'],
    totalBase: Number(row.total_base),
    totalCommission: Number(row.total_commission),
    totalAllowances: Number(row.total_allowances),
    totalDeductions: Number(row.total_deductions),
    totalNet: Number(row.total_net),
    employeeCount: row.employee_count,
    notes: row.notes,
    approvedAt: row.approved_at,
    paidAt: row.paid_at,
    expenseId: row.expense_id,
    periodStart: period?.period_start,
    periodEnd: period?.period_end,
    cycle: period?.cycle as PayRunRow['cycle'] | undefined,
  }
}

async function ensurePayrollSettings(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
): Promise<PayrollSettingsRow> {
  const { data: existing } = await admin
    .from('payroll_settings')
    .select('id, hotel_id, default_cycle, post_expense_on_paid')
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (existing) {
    return {
      id: existing.id,
      hotelId: existing.hotel_id,
      defaultCycle: existing.default_cycle,
      postExpenseOnPaid: existing.post_expense_on_paid,
    }
  }

  const { data: inserted } = await admin
    .from('payroll_settings')
    .insert({ hotel_id: hotelId })
    .select('id, hotel_id, default_cycle, post_expense_on_paid')
    .single()

  if (!inserted) {
    return {
      id: '',
      hotelId,
      defaultCycle: 'monthly',
      postExpenseOnPaid: true,
    }
  }

  return {
    id: inserted.id,
    hotelId: inserted.hotel_id,
    defaultCycle: inserted.default_cycle,
    postExpenseOnPaid: inserted.post_expense_on_paid,
  }
}

export async function loadPayrollOverview(
  hotelId: string,
  options?: { periodId?: string | null },
): Promise<PayrollOverviewData | null> {
  const access = await resolveHotelTenantAccess(hotelId, { roles: ['owner', 'manager'] })
  if (!access) return null

  const admin = createAdminClient()
  const settings = await ensurePayrollSettings(admin, hotelId)

  const [{ data: hotel }, { data: profiles }, { data: compensationRows }, { data: periods }, { data: rules }] =
    await Promise.all([
      admin.from('hotels').select('name').eq('id', hotelId).maybeSingle(),
      admin
        .from('profiles')
        .select('id, name, role, specialty, email, is_active, profile_image_path')
        .eq('hotel_id', hotelId)
        .neq('role', 'owner'),
      admin.from('employee_compensation').select('*').eq('hotel_id', hotelId),
      admin
        .from('pay_periods')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('period_start', { ascending: false })
        .limit(24),
      admin
        .from('commission_rules')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: true }),
    ])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const compensation = (compensationRows ?? []).map((row) =>
    mapCompensation(row, profileMap.get(row.profile_id) as Parameters<typeof mapCompensation>[1]),
  )

  const activeStaffCount = (profiles ?? []).filter((p) => p.is_active !== false).length
  const payrollActiveCount = compensation.filter((c) => c.payrollActive && c.staffActive !== false)
    .length

  const periodRows = (periods ?? []).map(mapPeriod)
  const bounds = defaultPeriodBounds(settings.defaultCycle)
  const isOwner = access.role === 'owner'

  let currentPeriod: PayPeriodRow | null = null

  if (options?.periodId === 'current') {
    // Explicit "current calendar window" — may be virtual until first run
    currentPeriod =
      periodRows.find(
        (p) => p.periodStart === bounds.periodStart && p.periodEnd === bounds.periodEnd,
      ) ?? null
  } else if (options?.periodId) {
    currentPeriod = periodRows.find((p) => p.id === options.periodId) ?? null
  } else {
    // Prefer an open period; never default to a closed/paid period (blocks next month)
    currentPeriod = periodRows.find((p) => p.status === 'open') ?? null
    if (!currentPeriod) {
      currentPeriod =
        periodRows.find(
          (p) => p.periodStart === bounds.periodStart && p.periodEnd === bounds.periodEnd,
        ) ?? null
    }
  }

  // Virtual current bounds when nothing matches this calendar window yet
  if (!currentPeriod) {
    currentPeriod = {
      id: '',
      hotelId,
      cycle: settings.defaultCycle,
      periodStart: bounds.periodStart,
      periodEnd: bounds.periodEnd,
      status: 'open',
    }
  }

  let currentRun: PayRunRow | null = null
  let lines: PayRunLineRow[] = []

  if (currentPeriod.id) {
    const { data: run } = await admin
      .from('pay_runs')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('pay_period_id', currentPeriod.id)
      .neq('status', 'void')
      .maybeSingle()

    if (run) {
      currentRun = mapRun(run, {
        period_start: currentPeriod.periodStart,
        period_end: currentPeriod.periodEnd,
        cycle: currentPeriod.cycle,
      })

      const { data: lineRows } = await admin
        .from('pay_run_lines')
        .select('*')
        .eq('pay_run_id', run.id)
        .eq('hotel_id', hotelId)
        .order('created_at', { ascending: true })

      const lineProfileIds = (lineRows ?? []).map((l) => l.profile_id)
      const missingIds = lineProfileIds.filter((id) => !profileMap.has(id))
      if (missingIds.length) {
        const { data: extra } = await admin
          .from('profiles')
          .select('id, name, role, specialty, email, is_active, profile_image_path')
          .in('id', missingIds)
        for (const p of extra ?? []) profileMap.set(p.id, p)
      }

      const compByProfile = new Map(compensation.map((c) => [c.profileId, c]))

      lines = (lineRows ?? []).map((l) => {
        const p = profileMap.get(l.profile_id)
        const comp = compByProfile.get(l.profile_id)
        return {
          id: l.id,
          hotelId: l.hotel_id,
          payRunId: l.pay_run_id,
          profileId: l.profile_id,
          basePay: Number(l.base_pay),
          commission: Number(l.commission),
          allowances: Number(l.allowances),
          deductions: Number(l.deductions),
          netPay: Number(l.net_pay),
          status: l.status as PayRunLineRow['status'],
          overrideReason: l.override_reason,
          notes: l.notes,
          staffName: p?.name ?? 'Staff',
          staffRole: (p?.role as UserRole) ?? 'technician',
          staffSpecialty: p?.specialty ?? null,
          profileImagePath: p?.profile_image_path ?? null,
          // Disbursement details are owner-only in the client payload
          momoNumber: isOwner ? (comp?.momoNumber ?? null) : null,
          bankName: isOwner ? (comp?.bankName ?? null) : null,
          bankAccount: isOwner ? (comp?.bankAccount ?? null) : null,
        }
      })
    }
  }

  const { data: historyRuns } = await admin
    .from('pay_runs')
    .select(
      'id, hotel_id, pay_period_id, status, total_base, total_commission, total_allowances, total_deductions, total_net, employee_count, notes, approved_at, paid_at, expense_id',
    )
    .eq('hotel_id', hotelId)
    .neq('status', 'void')
    .order('created_at', { ascending: false })
    .limit(12)

  const periodIds = [...new Set((historyRuns ?? []).map((r) => r.pay_period_id))]
  const periodLookup = new Map(periodRows.map((p) => [p.id, p]))
  if (periodIds.some((id) => !periodLookup.has(id))) {
    const { data: morePeriods } = await admin
      .from('pay_periods')
      .select('*')
      .eq('hotel_id', hotelId)
      .in('id', periodIds)
    for (const p of morePeriods ?? []) periodLookup.set(p.id, mapPeriod(p))
  }

  const history = (historyRuns ?? [])
    .map((r) => {
      const p = periodLookup.get(r.pay_period_id)
      if (!p) return null
      return {
        label: formatPeriodLabel(p.periodStart, p.periodEnd).replace(/ \d{4}/g, (m, offset) =>
          offset > 10 ? '' : m,
        ),
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        net: Number(r.total_net),
        commission: Number(r.total_commission),
        runId: r.id,
        status: r.status as PayRunRow['status'],
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .reverse()

  // Short month labels for chart
  const historyPoints = history.map((h) => ({
    ...h,
    label: parseMonthLabel(h.periodStart),
  }))

  const previousRun =
    (historyRuns ?? [])
      .filter((r) => r.id !== currentRun?.id && (r.status === 'paid' || r.status === 'approved'))
      .map((r) => {
        const p = periodLookup.get(r.pay_period_id)
        return mapRun(r, p ? { period_start: p.periodStart, period_end: p.periodEnd, cycle: p.cycle } : undefined)
      })[0] ?? null

  const unpaidNet = roundMoney(
    lines.filter((l) => l.status === 'unpaid').reduce((s, l) => s + l.netPay, 0),
  )

  const staffWithoutPay = (profiles ?? []).filter(
    (p) =>
      p.is_active !== false &&
      !compensation.some((c) => c.profileId === p.id && c.payrollActive && c.baseAmount > 0),
  ).length

  const commissionRules: CommissionRuleRow[] = (rules ?? []).map((r) => ({
    id: r.id,
    hotelId: r.hotel_id,
    name: r.name,
    trigger: r.trigger,
    rateType: r.rate_type,
    rateValue: Number(r.rate_value),
    percentBaseAmount: Number(r.percent_base_amount),
    taskType: r.task_type,
    roleFilter: r.role_filter,
    active: r.active,
  }))

  // Managers see pay amounts on the run, not TIN/SSNIT/bank master data
  const compensationForClient = isOwner
    ? compensation
    : compensation.map((c) => ({
        ...c,
        momoNumber: null,
        bankName: null,
        bankAccount: null,
        tin: null,
        ssnitNumber: null,
        notes: null,
      }))

  return {
    hotelName: hotel?.name ?? 'Property',
    settings,
    compensation: compensationForClient,
    activeStaffCount,
    payrollActiveCount,
    periods: periodRows,
    currentPeriod,
    currentRun,
    lines,
    history: historyPoints,
    commissionRules: isOwner ? commissionRules : commissionRules.filter((r) => r.active),
    previousRun,
    unpaidNet,
    exceptionsCount: staffWithoutPay,
  }
}

function parseMonthLabel(periodStart: string): string {
  const d = new Date(periodStart + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { month: 'short' })
}

export async function loadCommissionEntriesForLine(
  hotelId: string,
  lineId: string,
): Promise<CommissionEntryRow[]> {
  const access = await resolveHotelTenantAccess(hotelId, { roles: ['owner', 'manager'] })
  if (!access) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('commission_entries')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('pay_run_line_id', lineId)
    .order('accrued_on', { ascending: true })

  return (data ?? []).map((e) => ({
    id: e.id,
    hotelId: e.hotel_id,
    profileId: e.profile_id,
    ruleId: e.rule_id,
    sourceType: e.source_type,
    sourceId: e.source_id,
    description: e.description,
    amount: Number(e.amount),
    accruedOn: e.accrued_on,
    payPeriodId: e.pay_period_id,
    payRunLineId: e.pay_run_line_id,
    status: e.status,
  }))
}

export async function loadCompensationForProfile(
  hotelId: string,
  profileId: string,
): Promise<EmployeeCompensationRow | null> {
  const access = await resolveHotelTenantAccess(hotelId, { roles: ['owner', 'manager'] })
  if (!access) return null

  const admin = createAdminClient()
  const [{ data: row }, { data: profile }] = await Promise.all([
    admin
      .from('employee_compensation')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('profile_id', profileId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('id, name, role, specialty, email, is_active, profile_image_path')
      .eq('id', profileId)
      .maybeSingle(),
  ])

  if (!row) return null
  return mapCompensation(
    row,
    profile
      ? {
          name: profile.name,
          role: profile.role as UserRole,
          specialty: profile.specialty,
          email: profile.email,
          is_active: profile.is_active,
          profile_image_path: profile.profile_image_path,
        }
      : undefined,
  )
}

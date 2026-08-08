'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit/log'
import { loadVerifiedStaffProfile } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeNetPay,
  defaultPeriodBounds,
  formatPeriodLabel,
  roundMoney,
  sumRunTotals,
} from '@/lib/payroll/calculate'
import type { PayCycle, PayType } from '@/lib/payroll/types'

export type PayrollActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requirePayrollStaff(roles: Array<'owner' | 'manager'> = ['owner', 'manager']) {
  return loadVerifiedStaffProfile({ roles })
}

function revalidatePayroll() {
  revalidatePath('/owner/payroll')
  revalidatePath('/manager/payroll')
  revalidatePath('/owner/staff')
  revalidatePath('/manager/staff')
  revalidatePath('/owner/expenses')
  revalidatePath('/owner/dashboard')
}

const compensationSchema = z.object({
  profileId: z.string().uuid(),
  payType: z.enum(['salary', 'daily', 'hourly']),
  baseAmount: z.number().min(0),
  momoNumber: z.string().max(40).optional().nullable(),
  bankName: z.string().max(80).optional().nullable(),
  bankAccount: z.string().max(40).optional().nullable(),
  tin: z.string().max(40).optional().nullable(),
  ssnitNumber: z.string().max(40).optional().nullable(),
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  payrollActive: z.boolean(),
  notes: z.string().max(500).optional().nullable(),
})

const commissionRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  rateType: z.enum(['flat', 'percent']),
  rateValue: z.number().min(0),
  percentBaseAmount: z.number().min(0).optional(),
  taskType: z.enum(['clean', 'inspect', 'maintenance', 'restock']).nullable().optional(),
  roleFilter: z.enum(['manager', 'technician', 'receptionist']).nullable().optional(),
  active: z.boolean(),
})

const lineOverrideSchema = z.object({
  lineId: z.string().uuid(),
  basePay: z.number().min(0),
  commission: z.number().min(0),
  allowances: z.number().min(0),
  deductions: z.number().min(0),
  overrideReason: z.string().min(1).max(200),
  notes: z.string().max(500).optional().nullable(),
})

export async function upsertEmployeeCompensation(
  input: z.infer<typeof compensationSchema>,
): Promise<PayrollActionResult> {
  const parsed = compensationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid compensation.' }
  }

  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can set pay profiles.' }

  const admin = createAdminClient()
  const hotelId = profile.hotel_id

  const { data: target } = await admin
    .from('profiles')
    .select('id, hotel_id, role, name')
    .eq('id', parsed.data.profileId)
    .maybeSingle()

  if (!target || target.hotel_id !== hotelId) {
    return { success: false, error: 'Staff member not found for this property.' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'Owners are not paid through staff payroll.' }
  }

  const payload = {
    hotel_id: hotelId,
    profile_id: parsed.data.profileId,
    pay_type: parsed.data.payType as PayType,
    base_amount: roundMoney(parsed.data.baseAmount),
    momo_number: parsed.data.momoNumber?.trim() || null,
    bank_name: parsed.data.bankName?.trim() || null,
    bank_account: parsed.data.bankAccount?.trim() || null,
    tin: parsed.data.tin?.trim() || null,
    ssnit_number: parsed.data.ssnitNumber?.trim() || null,
    hire_date: parsed.data.hireDate || null,
    payroll_active: parsed.data.payrollActive,
    notes: parsed.data.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from('employee_compensation').upsert(payload, {
    onConflict: 'profile_id',
  })

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: parsed.data.profileId,
    action: 'compensation_updated',
    summary: `Pay profile updated for ${target.name}`,
    details: {
      payType: parsed.data.payType,
      baseAmount: parsed.data.baseAmount,
      payrollActive: parsed.data.payrollActive,
    },
  })

  revalidatePayroll()
  return { success: true }
}

export async function upsertCommissionRule(
  input: z.infer<typeof commissionRuleSchema>,
): Promise<PayrollActionResult<{ id: string }>> {
  const parsed = commissionRuleSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid rule.' }
  }

  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can edit commission rules.' }

  const admin = createAdminClient()
  const hotelId = profile.hotel_id
  const row = {
    hotel_id: hotelId,
    name: parsed.data.name.trim(),
    trigger: 'housekeeping_complete' as const,
    rate_type: parsed.data.rateType,
    rate_value: roundMoney(parsed.data.rateValue),
    percent_base_amount: roundMoney(parsed.data.percentBaseAmount ?? 0),
    task_type: parsed.data.taskType ?? 'clean',
    role_filter: parsed.data.roleFilter ?? null,
    active: parsed.data.active,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.id) {
    const { error } = await admin
      .from('commission_rules')
      .update(row)
      .eq('id', parsed.data.id)
      .eq('hotel_id', hotelId)
    if (error) return { success: false, error: error.message }
    void writeAuditLog({
      hotelId,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'payroll',
      entityId: parsed.data.id,
      action: 'commission_rule_updated',
      summary: `Commission rule updated: ${row.name}`,
    })
    revalidatePayroll()
    return { success: true, data: { id: parsed.data.id } }
  }

  const { data, error } = await admin.from('commission_rules').insert(row).select('id').single()
  if (error || !data) return { success: false, error: error?.message ?? 'Could not create rule.' }

  void writeAuditLog({
    hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: data.id,
    action: 'commission_rule_created',
    summary: `Commission rule created: ${row.name}`,
  })
  revalidatePayroll()
  return { success: true, data: { id: data.id } }
}

export async function deleteCommissionRule(ruleId: string): Promise<PayrollActionResult> {
  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can delete commission rules.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('commission_rules')
    .delete()
    .eq('id', ruleId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: ruleId,
    action: 'commission_rule_deleted',
    summary: 'Commission rule deleted',
  })
  revalidatePayroll()
  return { success: true }
}

export async function updatePayrollSettings(input: {
  defaultCycle: PayCycle
  postExpenseOnPaid: boolean
}): Promise<PayrollActionResult> {
  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can update payroll settings.' }

  const admin = createAdminClient()
  const { error } = await admin.from('payroll_settings').upsert(
    {
      hotel_id: profile.hotel_id,
      default_cycle: input.defaultCycle,
      post_expense_on_paid: input.postExpenseOnPaid,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'hotel_id' },
  )

  if (error) return { success: false, error: error.message }
  revalidatePayroll()
  return { success: true }
}

export async function createOrRegeneratePayRun(input?: {
  periodStart?: string
  periodEnd?: string
  cycle?: PayCycle
  periodId?: string
}): Promise<PayrollActionResult<{ runId: string; periodId: string }>> {
  const profile = await requirePayrollStaff(['owner', 'manager'])
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const hotelId = profile.hotel_id

  const { data: settings } = await admin
    .from('payroll_settings')
    .select('default_cycle')
    .eq('hotel_id', hotelId)
    .maybeSingle()

  const cycle = (input?.cycle ?? settings?.default_cycle ?? 'monthly') as PayCycle
  const bounds =
    input?.periodStart && input?.periodEnd
      ? { periodStart: input.periodStart, periodEnd: input.periodEnd }
      : defaultPeriodBounds(cycle)

  let periodId = input?.periodId ?? null
  let periodStart = bounds.periodStart
  let periodEnd = bounds.periodEnd

  if (periodId) {
    const { data: existingPeriod } = await admin
      .from('pay_periods')
      .select('id, status, period_start, period_end, cycle')
      .eq('id', periodId)
      .eq('hotel_id', hotelId)
      .maybeSingle()
    if (!existingPeriod) return { success: false, error: 'Pay period not found.' }
    periodStart = existingPeriod.period_start
    periodEnd = existingPeriod.period_end
  } else {
    const { data: existingPeriod } = await admin
      .from('pay_periods')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('period_start', bounds.periodStart)
      .eq('period_end', bounds.periodEnd)
      .maybeSingle()

    if (existingPeriod) {
      periodId = existingPeriod.id
    } else {
      const { data: created, error } = await admin
        .from('pay_periods')
        .insert({
          hotel_id: hotelId,
          cycle,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'open',
        })
        .select('id')
        .single()
      if (error || !created) return { success: false, error: error?.message ?? 'Could not create period.' }
      periodId = created.id
    }
  }

  const { data: existingRun } = await admin
    .from('pay_runs')
    .select('id, status')
    .eq('pay_period_id', periodId)
    .eq('hotel_id', hotelId)
    .neq('status', 'void')
    .maybeSingle()

  if (existingRun && (existingRun.status === 'paid' || existingRun.status === 'approved')) {
    return {
      success: false,
      error:
        'This period already has an approved or paid run. Start the next pay period from the period picker.',
    }
  }

  if (existingRun?.status === 'pending_approval' && profile.role !== 'owner') {
    return {
      success: false,
      error: 'Only owners can regenerate a run that is awaiting approval.',
    }
  }

  let runId = existingRun?.id ?? null

  // Unlink commissions BEFORE reading accruals so regenerate keeps included amounts
  if (runId) {
    const { data: oldLines } = await admin
      .from('pay_run_lines')
      .select('id')
      .eq('pay_run_id', runId)

    const oldLineIds = (oldLines ?? []).map((l) => l.id)
    if (oldLineIds.length) {
      await admin
        .from('commission_entries')
        .update({
          pay_run_line_id: null,
          pay_period_id: null,
          status: 'accrued',
          updated_at: new Date().toISOString(),
        })
        .in('pay_run_line_id', oldLineIds)
        .eq('hotel_id', hotelId)
    }

    await admin.from('pay_run_lines').delete().eq('pay_run_id', runId).eq('hotel_id', hotelId)
    await admin
      .from('pay_runs')
      .update({
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', runId)
  } else {
    const { data: createdRun, error } = await admin
      .from('pay_runs')
      .insert({
        hotel_id: hotelId,
        pay_period_id: periodId,
        status: 'draft',
        created_by: profile.id,
      })
      .select('id')
      .single()
    if (error || !createdRun) return { success: false, error: error?.message ?? 'Could not create run.' }
    runId = createdRun.id
  }

  // Load active compensation + profiles
  const { data: comps } = await admin
    .from('employee_compensation')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('payroll_active', true)

  const profileIds = (comps ?? []).map((c) => c.profile_id)
  const { data: staffProfiles } = profileIds.length
    ? await admin
        .from('profiles')
        .select('id, is_active, name')
        .in('id', profileIds)
        .eq('hotel_id', hotelId)
    : { data: [] as Array<{ id: string; is_active: boolean | null; name: string }> }

  const activeIds = new Set(
    (staffProfiles ?? []).filter((p) => p.is_active !== false).map((p) => p.id),
  )
  const activeComps = (comps ?? []).filter((c) => activeIds.has(c.profile_id))

  // Accrued commissions in period (after unlink so regenerate includes them)
  const { data: commissions } = await admin
    .from('commission_entries')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'accrued')
    .gte('accrued_on', periodStart)
    .lte('accrued_on', periodEnd)

  const commissionByProfile = new Map<string, number>()
  for (const entry of commissions ?? []) {
    commissionByProfile.set(
      entry.profile_id,
      roundMoney((commissionByProfile.get(entry.profile_id) ?? 0) + Number(entry.amount)),
    )
  }

  const allProfileIds = new Set([
    ...activeComps.map((c) => c.profile_id),
    ...commissionByProfile.keys(),
  ])

  if (allProfileIds.size === 0) {
    return {
      success: false,
      error: 'No payroll-active staff or accrued commissions for this period. Set pay profiles first.',
    }
  }

  const compMap = new Map(activeComps.map((c) => [c.profile_id, c]))
  const linePayloads = [...allProfileIds].map((pid) => {
    const comp = compMap.get(pid)
    // base_amount is the full period amount (salary monthly / agreed period total)
    const basePay = roundMoney(Number(comp?.base_amount ?? 0))
    const commission = roundMoney(commissionByProfile.get(pid) ?? 0)
    const allowances = 0
    const deductions = 0
    return {
      hotel_id: hotelId,
      pay_run_id: runId!,
      profile_id: pid,
      base_pay: basePay,
      commission,
      allowances,
      deductions,
      net_pay: computeNetPay({ basePay, commission, allowances, deductions }),
      status: 'unpaid' as const,
    }
  })

  const { data: insertedLines, error: lineError } = await admin
    .from('pay_run_lines')
    .insert(linePayloads)
    .select('id, profile_id')

  if (lineError) return { success: false, error: lineError.message }

  const lineByProfile = new Map((insertedLines ?? []).map((l) => [l.profile_id, l.id]))

  for (const entry of commissions ?? []) {
    const lineId = lineByProfile.get(entry.profile_id)
    if (!lineId) continue
    await admin
      .from('commission_entries')
      .update({
        pay_run_line_id: lineId,
        pay_period_id: periodId,
        status: 'included',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entry.id)
      .eq('hotel_id', hotelId)
  }

  const totals = sumRunTotals(
    linePayloads.map((l) => ({
      basePay: l.base_pay,
      commission: l.commission,
      allowances: l.allowances,
      deductions: l.deductions,
      netPay: l.net_pay,
      status: l.status,
    })),
  )

  await admin
    .from('pay_runs')
    .update({
      ...{
        total_base: totals.totalBase,
        total_commission: totals.totalCommission,
        total_allowances: totals.totalAllowances,
        total_deductions: totals.totalDeductions,
        total_net: totals.totalNet,
        employee_count: totals.employeeCount,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)

  void writeAuditLog({
    hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: runId,
    action: existingRun ? 'pay_run_regenerated' : 'pay_run_created',
    summary: `Pay run ${existingRun ? 'regenerated' : 'created'} for ${formatPeriodLabel(periodStart, periodEnd)}`,
    details: totals,
  })

  revalidatePayroll()
  return { success: true, data: { runId, periodId } }
}

export async function updatePayRunLine(
  input: z.infer<typeof lineOverrideSchema>,
): Promise<PayrollActionResult> {
  const parsed = lineOverrideSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid line.' }
  }

  // Amount overrides are owner-only (managers prepare drafts; owners set rates)
  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can edit pay amounts.' }

  const admin = createAdminClient()
  const hotelId = profile.hotel_id

  const { data: line } = await admin
    .from('pay_run_lines')
    .select('id, pay_run_id')
    .eq('id', parsed.data.lineId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!line) return { success: false, error: 'Pay line not found.' }

  const { data: run } = await admin
    .from('pay_runs')
    .select('id, status')
    .eq('id', line.pay_run_id)
    .maybeSingle()

  if (!run || (run.status !== 'draft' && run.status !== 'pending_approval')) {
    return { success: false, error: 'Only draft runs can be edited.' }
  }

  const netPay = computeNetPay({
    basePay: parsed.data.basePay,
    commission: parsed.data.commission,
    allowances: parsed.data.allowances,
    deductions: parsed.data.deductions,
  })

  const { error } = await admin
    .from('pay_run_lines')
    .update({
      base_pay: roundMoney(parsed.data.basePay),
      commission: roundMoney(parsed.data.commission),
      allowances: roundMoney(parsed.data.allowances),
      deductions: roundMoney(parsed.data.deductions),
      net_pay: netPay,
      override_reason: parsed.data.overrideReason.trim(),
      notes: parsed.data.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.lineId)
    .eq('hotel_id', hotelId)

  if (error) return { success: false, error: error.message }

  await refreshRunTotals(admin, hotelId, line.pay_run_id)

  void writeAuditLog({
    hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: parsed.data.lineId,
    action: 'pay_line_overridden',
    summary: `Pay line edited: ${parsed.data.overrideReason.trim()}`,
    details: { netPay },
  })

  revalidatePayroll()
  return { success: true }
}

async function refreshRunTotals(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  runId: string,
) {
  const { data: lines } = await admin
    .from('pay_run_lines')
    .select('base_pay, commission, allowances, deductions, net_pay, status')
    .eq('pay_run_id', runId)
    .eq('hotel_id', hotelId)

  const totals = sumRunTotals(
    (lines ?? []).map((l) => ({
      basePay: Number(l.base_pay),
      commission: Number(l.commission),
      allowances: Number(l.allowances),
      deductions: Number(l.deductions),
      netPay: Number(l.net_pay),
      status: l.status,
    })),
  )

  await admin
    .from('pay_runs')
    .update({
      total_base: totals.totalBase,
      total_commission: totals.totalCommission,
      total_allowances: totals.totalAllowances,
      total_deductions: totals.totalDeductions,
      total_net: totals.totalNet,
      employee_count: totals.employeeCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

export async function submitPayRunForApproval(runId: string): Promise<PayrollActionResult> {
  const profile = await requirePayrollStaff(['owner', 'manager'])
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: run } = await admin
    .from('pay_runs')
    .select('id, status')
    .eq('id', runId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!run) return { success: false, error: 'Pay run not found.' }
  if (run.status !== 'draft') return { success: false, error: 'Only draft runs can be submitted.' }

  const { error } = await admin
    .from('pay_runs')
    .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
    .eq('id', runId)

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: runId,
    action: 'pay_run_submitted',
    summary: 'Pay run submitted for approval',
  })

  revalidatePayroll()
  return { success: true }
}

export async function approvePayRun(runId: string): Promise<PayrollActionResult> {
  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can approve payroll.' }

  const admin = createAdminClient()
  const { data: run } = await admin
    .from('pay_runs')
    .select('id, status')
    .eq('id', runId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!run) return { success: false, error: 'Pay run not found.' }
  if (run.status !== 'draft' && run.status !== 'pending_approval') {
    return { success: false, error: 'This run cannot be approved.' }
  }

  const now = new Date().toISOString()
  const { data: approved, error } = await admin
    .from('pay_runs')
    .update({
      status: 'approved',
      approved_by: profile.id,
      approved_at: now,
      updated_at: now,
    })
    .eq('id', runId)
    .eq('hotel_id', profile.hotel_id)
    .in('status', ['draft', 'pending_approval'])
    .select('id')
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!approved) return { success: false, error: 'Could not approve (status changed).' }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: runId,
    action: 'pay_run_approved',
    summary: 'Pay run approved',
  })

  revalidatePayroll()
  return { success: true }
}

export async function markPayRunPaid(runId: string): Promise<PayrollActionResult> {
  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can mark payroll paid.' }

  const admin = createAdminClient()
  const hotelId = profile.hotel_id
  const now = new Date().toISOString()

  const { data: run } = await admin
    .from('pay_runs')
    .select('*')
    .eq('id', runId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!run) return { success: false, error: 'Pay run not found.' }
  if (run.status === 'paid') return { success: false, error: 'This run is already paid.' }
  if (run.status === 'void') return { success: false, error: 'This run was voided.' }

  // Inline approve (no nested action) so we re-read fresh totals afterward
  if (run.status === 'draft' || run.status === 'pending_approval') {
    const { data: approved } = await admin
      .from('pay_runs')
      .update({
        status: 'approved',
        approved_by: profile.id,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', runId)
      .eq('hotel_id', hotelId)
      .in('status', ['draft', 'pending_approval'])
      .select('id')
      .maybeSingle()

    if (!approved) {
      return { success: false, error: 'Could not approve this run (it may have changed).' }
    }

    void writeAuditLog({
      hotelId,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'payroll',
      entityId: runId,
      action: 'pay_run_approved',
      summary: 'Pay run approved',
    })
  }

  await refreshRunTotals(admin, hotelId, runId)

  const { data: fresh } = await admin
    .from('pay_runs')
    .select('*')
    .eq('id', runId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!fresh) return { success: false, error: 'Pay run not found.' }
  if (fresh.status === 'paid') return { success: false, error: 'This run is already paid.' }
  if (fresh.status !== 'approved') {
    return { success: false, error: 'Approve the run before marking paid.' }
  }

  const [{ data: settings }, { data: period }] = await Promise.all([
    admin.from('payroll_settings').select('post_expense_on_paid').eq('hotel_id', hotelId).maybeSingle(),
    admin
      .from('pay_periods')
      .select('period_start, period_end')
      .eq('id', fresh.pay_period_id)
      .maybeSingle(),
  ])

  let expenseId: string | null = fresh.expense_id
  if (settings?.post_expense_on_paid !== false && !expenseId) {
    const label =
      period?.period_start && period?.period_end
        ? formatPeriodLabel(period.period_start, period.period_end)
        : 'Payroll'
    const { data: expense } = await admin
      .from('expenses')
      .insert({
        hotel_id: hotelId,
        category: 'Payroll',
        description: `Payroll – ${label}`,
        amount: Number(fresh.total_net),
        expense_date: period?.period_end ?? now.slice(0, 10),
        vendor: 'Staff payroll',
        payment_status: 'paid',
        created_by: profile.id,
      })
      .select('id')
      .single()
    expenseId = expense?.id ?? null
  }

  // Atomic paid transition — prevents double expense / double mark-paid races
  const { data: paid } = await admin
    .from('pay_runs')
    .update({
      status: 'paid',
      paid_by: profile.id,
      paid_at: now,
      expense_id: expenseId,
      updated_at: now,
    })
    .eq('id', runId)
    .eq('hotel_id', hotelId)
    .eq('status', 'approved')
    .select('id')
    .maybeSingle()

  if (!paid) {
    return {
      success: false,
      error: 'Could not mark paid (already paid or status changed).',
    }
  }

  await admin
    .from('pay_run_lines')
    .update({ status: 'paid', updated_at: now })
    .eq('pay_run_id', runId)
    .eq('hotel_id', hotelId)
    .neq('status', 'excluded')

  await admin
    .from('pay_periods')
    .update({ status: 'closed', updated_at: now })
    .eq('id', fresh.pay_period_id)
    .eq('hotel_id', hotelId)

  void writeAuditLog({
    hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: runId,
    action: 'pay_run_paid',
    summary: `Pay run marked paid (₵${Number(fresh.total_net).toLocaleString()})`,
    details: { expenseId, totalNet: Number(fresh.total_net) },
  })

  revalidatePayroll()
  return { success: true }
}

export async function getCommissionEntriesForLine(
  lineId: string,
): Promise<PayrollActionResult<Array<{
  id: string
  description: string
  amount: number
  accruedOn: string
}>>> {
  const profile = await requirePayrollStaff(['owner', 'manager'])
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('commission_entries')
    .select('id, description, amount, accrued_on')
    .eq('hotel_id', profile.hotel_id)
    .eq('pay_run_line_id', lineId)
    .order('accrued_on', { ascending: true })

  return {
    success: true,
    data: (data ?? []).map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      accruedOn: e.accrued_on,
    })),
  }
}

export async function addManualCommission(input: {
  profileId: string
  amount: number
  description: string
  accruedOn?: string
}): Promise<PayrollActionResult> {
  const schema = z.object({
    profileId: z.string().uuid(),
    amount: z.number().positive(),
    description: z.string().min(1).max(200),
    accruedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid commission.' }
  }

  const profile = await requirePayrollStaff(['owner'])
  if (!profile?.hotel_id) return { success: false, error: 'Only owners can add manual commissions.' }

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('id, hotel_id, role, is_active')
    .eq('id', parsed.data.profileId)
    .maybeSingle()

  if (!target || target.hotel_id !== profile.hotel_id) {
    return { success: false, error: 'Staff member not found for this property.' }
  }
  if (target.role === 'owner') {
    return { success: false, error: 'Cannot add commission for the property owner.' }
  }
  if (target.is_active === false) {
    return { success: false, error: 'Staff member is inactive.' }
  }

  const { error } = await admin.from('commission_entries').insert({
    hotel_id: profile.hotel_id,
    profile_id: parsed.data.profileId,
    source_type: 'manual',
    description: parsed.data.description.trim(),
    amount: roundMoney(parsed.data.amount),
    accrued_on: parsed.data.accruedOn ?? new Date().toISOString().slice(0, 10),
    status: 'accrued',
  })

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payroll',
    entityId: parsed.data.profileId,
    action: 'manual_commission_added',
    summary: `Manual commission ₵${parsed.data.amount}: ${parsed.data.description}`,
  })

  revalidatePayroll()
  return { success: true }
}

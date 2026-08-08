import type { createAdminClient } from '@/lib/supabase/admin'
import { computeCommissionAmount, toISODate } from '@/lib/payroll/calculate'
import type { HousekeepingTaskType, UserRole } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Accrue commission for a completed housekeeping task using active hotel rules.
 * Idempotent via unique index on (hotel, source_type, source_id, rule_id).
 */
export async function accrueHousekeepingCommissions(
  admin: AdminClient,
  input: {
    hotelId: string
    taskId: string
    taskType: HousekeepingTaskType
    /** Staff who completed / was assigned the work */
    earnerProfileId: string | null
    earnerRole?: UserRole | null
    roomLabel?: string | null
    accruedOn?: string
  },
): Promise<{ created: number }> {
  if (!input.earnerProfileId) return { created: 0 }

  const { data: rules } = await admin
    .from('commission_rules')
    .select(
      'id, name, trigger, rate_type, rate_value, percent_base_amount, task_type, role_filter, active',
    )
    .eq('hotel_id', input.hotelId)
    .eq('active', true)
    .eq('trigger', 'housekeeping_complete')

  if (!rules?.length) return { created: 0 }

  const accruedOn = input.accruedOn ?? toISODate(new Date())
  let created = 0

  for (const rule of rules) {
    if (rule.task_type && rule.task_type !== input.taskType) continue
    if (rule.role_filter && input.earnerRole && rule.role_filter !== input.earnerRole) continue
    if (rule.role_filter && !input.earnerRole) continue

    const amount = computeCommissionAmount(
      rule.rate_type as 'flat' | 'percent',
      Number(rule.rate_value),
      Number(rule.percent_base_amount),
    )
    if (amount <= 0) continue

    const roomBit = input.roomLabel ? ` · Room ${input.roomLabel}` : ''
    const description = `${rule.name}${roomBit}`

    const { error } = await admin.from('commission_entries').insert({
      hotel_id: input.hotelId,
      profile_id: input.earnerProfileId,
      rule_id: rule.id,
      source_type: 'housekeeping_task',
      source_id: input.taskId,
      description,
      amount,
      accrued_on: accruedOn,
      status: 'accrued',
    })

    // Unique violation = already accrued — ignore
    if (error) {
      if (error.code === '23505') continue
      console.error('[payroll] commission accrual failed', {
        hotelId: input.hotelId,
        taskId: input.taskId,
        ruleId: rule.id,
        message: error.message,
        code: error.code,
      })
      continue
    }
    created += 1
  }

  return { created }
}

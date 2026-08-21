import { formatGhs } from '@/lib/format/money'
import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'

export const PAYMENT_VOID_ALERT_DAYS = 7

export type PaymentVoidAuditRow = {
  id: string
  actor_id: string | null
  actor_name: string | null
  entity_id: string | null
  summary: string
  details: Record<string, unknown> | null
  created_at: string
}

export type PaymentVoidAlert = {
  id: string
  title: string
  subtitle: string
  href: string
  urgent: boolean
}

function roleLabel(role: unknown): string | null {
  if (role === 'receptionist') return 'reception'
  if (role === 'manager') return 'manager'
  if (role === 'owner') return 'owner'
  return null
}

export function paymentVoidSinceISO(now = new Date()): string {
  const start = new Date(now)
  start.setDate(start.getDate() - PAYMENT_VOID_ALERT_DAYS)
  return start.toISOString()
}

/**
 * Owner-dashboard copy for a desk-payment void. Skips the viewer's own voids
 * so owners are not alerted about an action they just took.
 */
export function paymentVoidAlertFromAudit(
  row: PaymentVoidAuditRow,
  input: { viewerId: string; billingHref: string },
): PaymentVoidAlert | null {
  if (row.actor_id && row.actor_id === input.viewerId) return null

  const amount = Number(row.details?.voidedAmount ?? 0)
  const role = roleLabel(row.details?.actorRole)
  const actor = row.actor_name?.trim() || 'Staff'
  const who = role ? `${actor} (${role})` : actor
  const guestMatch = /on (.+) invoice$/i.exec(row.summary ?? '')
  const guest = guestMatch?.[1]?.trim() || 'a guest'

  const href = row.entity_id
    ? `${input.billingHref}?open=${encodeURIComponent(row.entity_id)}`
    : input.billingHref

  return {
    id: `void-${row.id}`,
    title: 'Desk payment voided',
    subtitle:
      amount > 0.009
        ? `${who} cleared ${formatGhs(amount)} on ${guest}`
        : `${who} cleared the paid flag on ${guest}`,
    href,
    urgent: true,
  }
}

export async function getOwnerPaymentVoidAttention(): Promise<
  Array<{ id: string; message: string; href: string }>
> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'owner') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, actor_id, actor_name, entity_id, summary, details, created_at')
    .eq('hotel_id', profile.hotel_id)
    .eq('entity_type', 'invoice')
    .eq('action', 'payment_voided')
    .gte('created_at', paymentVoidSinceISO())
    .order('created_at', { ascending: false })
    .limit(10)

  const alerts: Array<{ id: string; message: string; href: string }> = []
  for (const row of data ?? []) {
    const alert = paymentVoidAlertFromAudit(
      {
        ...row,
        details: (row.details as Record<string, unknown> | null) ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
      },
      { viewerId: profile.id, billingHref: '/owner/billing' },
    )
    if (!alert) continue
    alerts.push({ id: alert.id, message: `${alert.title}: ${alert.subtitle}`, href: alert.href })
  }
  return alerts
}


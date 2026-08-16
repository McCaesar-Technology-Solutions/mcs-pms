import { createAdminClient } from '@/lib/supabase/admin'
import { resolveHotelTenantAccess } from '@/lib/data/tenant-guard'
import { maskEmail, maskPhone } from '@/lib/auth/mfa-sms'

export interface DeadNotificationRow {
  id: string
  channel: 'sms' | 'email' | 'whatsapp'
  recipientMasked: string
  templateKey: string
  lastError: string | null
  createdAt: string
}

function maskRecipient(channel: 'sms' | 'email' | 'whatsapp', recipient: string): string {
  if (channel === 'email' || recipient.includes('@')) return maskEmail(recipient)
  return maskPhone(recipient)
}

export async function getRecentDeadNotifications(
  hotelId: string,
  limit = 20,
): Promise<DeadNotificationRow[]> {
  const profile = await resolveHotelTenantAccess(hotelId, {
    roles: ['owner', 'manager'],
  })
  if (!profile) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('notification_outbox')
    .select('id, channel, recipient, template_key, last_error, created_at')
    .eq('hotel_id', hotelId)
    .eq('status', 'dead')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => ({
    id: row.id,
    channel: row.channel,
    recipientMasked: maskRecipient(row.channel, row.recipient),
    templateKey: row.template_key,
    lastError: row.last_error,
    createdAt: row.created_at ?? new Date().toISOString(),
  }))
}

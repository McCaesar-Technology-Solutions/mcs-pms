import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'

export interface NotificationLogEntry {
  id: string
  recipientPhone: string
  channel: 'sms' | 'whatsapp'
  templateKey: string
  body: string
  provider: string | null
  status: 'sent' | 'failed' | 'skipped'
  errorMessage: string | null
  createdAt: string
}

export async function getNotificationLog(limit = 50): Promise<NotificationLogEntry[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []
  if (!['owner', 'manager'].includes(profile.role)) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .eq('hotel_id', profile.hotel_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    recipientPhone: row.recipient_phone,
    channel: row.channel,
    templateKey: row.template_key,
    body: row.body,
    provider: row.provider,
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at ?? new Date().toISOString(),
  }))
}

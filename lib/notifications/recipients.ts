import { createAdminClient } from '@/lib/supabase/admin'
import {
  isTemplateEnabled,
  mergeNotificationPrefs,
  type NotificationSmsPrefs,
  type NotificationTemplateKey,
} from '@/lib/notifications/preferences'

/** Manager phones for a property; falls back to owner if no manager on file. */
export async function managerPhones(hotelId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('phone, role')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('role', ['manager', 'owner'])
    .not('phone', 'is', null)

  const managers = (data ?? []).filter((p) => p.role === 'manager' && p.phone)
  const phones = managers.map((p) => p.phone!)
  if (phones.length > 0) return phones

  return (data ?? [])
    .filter((p) => p.role === 'owner' && p.phone)
    .map((p) => p.phone!)
}

export async function technicianPhone(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('phone').eq('id', userId).maybeSingle()
  return data?.phone?.trim() ?? null
}

export async function loadHotelNotificationPrefs(
  hotelId: string,
): Promise<Record<NotificationTemplateKey, boolean>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('notification_sms_prefs')
    .eq('id', hotelId)
    .maybeSingle()

  return mergeNotificationPrefs(
    (data?.notification_sms_prefs as NotificationSmsPrefs | null) ?? null,
  )
}

export async function shouldSendHotelNotification(
  hotelId: string | undefined,
  templateKey: string,
): Promise<boolean> {
  if (!hotelId) return true
  const prefs = await loadHotelNotificationPrefs(hotelId)
  return isTemplateEnabled(prefs, templateKey)
}

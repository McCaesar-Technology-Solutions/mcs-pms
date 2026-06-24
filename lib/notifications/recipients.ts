import { createAdminClient } from '@/lib/supabase/admin'
import {
  isTemplateEnabled,
  mergeNotificationPrefs,
  type NotificationSmsPrefs,
  type NotificationTemplateKey,
} from '@/lib/notifications/preferences'
import {
  EMAIL_ALWAYS_SEND,
  EMAIL_STAFF_TEMPLATE_KEYS,
  isEmailTemplateEnabled,
  mergeEmailPrefs,
  type NotificationEmailPrefs,
  type EmailStaffTemplateKey,
} from '@/lib/notifications/email-preferences'

const SYNTHETIC_EMAIL_SUFFIX = '@invite.mojo.local'

function isRealStaffEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  return !email.trim().toLowerCase().endsWith(SYNTHETIC_EMAIL_SUFFIX)
}

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

/** Property owner phone(s) from hotels.owner_id. */
export async function ownerPhones(hotelId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('owner_id')
    .eq('id', hotelId)
    .maybeSingle()

  if (!hotel?.owner_id) return []

  const { data: profile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', hotel.owner_id)
    .eq('is_active', true)
    .maybeSingle()

  const phone = profile?.phone?.trim()
  return phone ? [phone] : []
}

/** Property owner email from hotels.owner_id. */
export async function ownerEmails(hotelId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('owner_id')
    .eq('id', hotelId)
    .maybeSingle()

  if (!hotel?.owner_id) return []

  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', hotel.owner_id)
    .eq('is_active', true)
    .maybeSingle()

  const email = profile?.email?.trim().toLowerCase()
  if (!email || !isRealStaffEmail(email)) return []
  return [email]
}

/** Manager emails for a property; falls back to owner if no manager on file. */
export async function managerEmails(hotelId: string): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('email, role')
    .eq('hotel_id', hotelId)
    .eq('is_active', true)
    .in('role', ['manager', 'owner'])
    .not('email', 'is', null)

  const managers = (data ?? []).filter((p) => p.role === 'manager' && isRealStaffEmail(p.email))
  const emails = managers.map((p) => p.email!.trim().toLowerCase())
  if (emails.length > 0) return [...new Set(emails)]

  return [
    ...new Set(
      (data ?? [])
        .filter((p) => p.role === 'owner' && isRealStaffEmail(p.email))
        .map((p) => p.email!.trim().toLowerCase()),
    ),
  ]
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

export async function loadHotelEmailNotificationPrefs(
  hotelId: string,
): Promise<Record<EmailStaffTemplateKey, boolean>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('notification_email_prefs')
    .eq('id', hotelId)
    .maybeSingle()

  return mergeEmailPrefs(
    (data?.notification_email_prefs as NotificationEmailPrefs | null) ?? null,
  )
}

export async function shouldSendHotelEmailNotification(
  hotelId: string | undefined,
  templateKey: string,
): Promise<boolean> {
  if (templateKey === 'mfa_otp') return true
  if (EMAIL_ALWAYS_SEND.has(templateKey as EmailStaffTemplateKey)) return true
  if (!hotelId) return false
  if (!(EMAIL_STAFF_TEMPLATE_KEYS as readonly string[]).includes(templateKey)) return false
  const prefs = await loadHotelEmailNotificationPrefs(hotelId)
  return isEmailTemplateEnabled(prefs, templateKey)
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { updateHotelSettingsSchema, updateNotificationPrefsSchema } from '@/lib/validations'
import type { NotificationSmsPrefs } from '@/lib/notifications/preferences'
import { NOTIFICATION_TEMPLATE_KEYS } from '@/lib/notifications/preferences'
import type { NotificationEmailPrefs } from '@/lib/notifications/email-preferences'
import { EMAIL_STAFF_TEMPLATE_KEYS } from '@/lib/notifications/email-preferences'

export type SettingsActionResult = { success: true } | { success: false; error: string }

function revalidateSettingsViews() {
  revalidatePath('/owner/settings')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
}

export async function updateHotelSettings(input: {
  hotelId: string
  name: string
  address: string
  city: string
  region: string
  gta_license_number?: string
  gta_license_expiry?: string
  vat_registration_number?: string
  vat_mode?: 'exclusive' | 'inclusive'
  invoice_prefix?: string
}): Promise<SettingsActionResult> {
  const parsed = updateHotelSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'owner') {
    return { success: false, error: 'Only owners can update property settings.' }
  }

  if (!(await ownerOwnsHotel(user.id, parsed.data.hotelId))) {
    return { success: false, error: 'You do not have access to this property.' }
  }

  const { error } = await supabase
    .from('hotels')
    .update({
      name: parsed.data.name.trim(),
      address: parsed.data.address.trim(),
      city: parsed.data.city.trim(),
      region: parsed.data.region.trim(),
      gta_license_number: parsed.data.gta_license_number?.trim() || null,
      gta_license_expiry: parsed.data.gta_license_expiry || null,
      vat_registration_number: parsed.data.vat_registration_number?.trim() || null,
      ...(parsed.data.vat_mode ? { vat_mode: parsed.data.vat_mode } : {}),
      ...(parsed.data.invoice_prefix?.trim()
        ? { invoice_prefix: parsed.data.invoice_prefix.trim().toUpperCase() }
        : {}),
    })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  revalidateSettingsViews()
  return { success: true }
}

export async function updateNotificationPreferences(input: {
  hotelId: string
  prefs: NotificationSmsPrefs
}): Promise<SettingsActionResult> {
  const parsed = updateNotificationPrefsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'owner') {
    return { success: false, error: 'Only owners can update notification settings.' }
  }

  if (!(await ownerOwnsHotel(user.id, parsed.data.hotelId))) {
    return { success: false, error: 'You do not have access to this property.' }
  }

  const prefs: NotificationSmsPrefs = {}
  for (const key of NOTIFICATION_TEMPLATE_KEYS) {
    if (typeof parsed.data.prefs[key] === 'boolean') {
      prefs[key] = parsed.data.prefs[key]!
    }
  }

  const { error } = await supabase
    .from('hotels')
    .update({ notification_sms_prefs: prefs })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  revalidateSettingsViews()
  return { success: true }
}

export async function updateEmailNotificationPreferences(input: {
  hotelId: string
  prefs: NotificationEmailPrefs
}): Promise<SettingsActionResult> {
  const parsed = updateNotificationPrefsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'owner') {
    return { success: false, error: 'Only owners can update notification settings.' }
  }

  if (!(await ownerOwnsHotel(user.id, parsed.data.hotelId))) {
    return { success: false, error: 'You do not have access to this property.' }
  }

  const prefs: NotificationEmailPrefs = {}
  for (const key of EMAIL_STAFF_TEMPLATE_KEYS) {
    if (typeof parsed.data.prefs[key] === 'boolean') {
      prefs[key] = parsed.data.prefs[key]!
    }
  }

  const { error } = await supabase
    .from('hotels')
    .update({ notification_email_prefs: prefs })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  revalidateSettingsViews()
  return { success: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { updateHotelSettingsSchema, updateNotificationPrefsSchema, updateReservationLifecycleSettingsSchema } from '@/lib/validations'
import type { NotificationSmsPrefs } from '@/lib/notifications/preferences'
import { NOTIFICATION_TEMPLATE_KEYS } from '@/lib/notifications/preferences'
import type { NotificationEmailPrefs } from '@/lib/notifications/email-preferences'
import { EMAIL_STAFF_TEMPLATE_KEYS } from '@/lib/notifications/email-preferences'
import { normalizeHotelTimezone } from '@/lib/hotel-time'
import { writeAuditLog } from '@/lib/audit/log'

export type SettingsActionResult = { success: true } | { success: false; error: string }

function revalidateSettingsViews() {
  revalidatePath('/owner/settings')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
}

async function requireOwnerSettings(hotelId: string) {
  const result = await requireVerifiedStaff({ roles: ['owner'] })
  if (!result.ok) return { ok: false as const, error: result.error ?? 'Not authorized.' }
  if (!(await ownerOwnsHotel(result.userId, hotelId))) {
    return { ok: false as const, error: 'You do not have access to this property.' }
  }
  return { ok: true as const, userId: result.userId, profile: result.profile }
}

async function requireOwnerOrManagerSettings(hotelId: string) {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager'] })
  if (!result.ok) return { ok: false as const, error: result.error ?? 'Not authorized.' }

  if (result.profile.role === 'owner') {
    if (!(await ownerOwnsHotel(result.userId, hotelId))) {
      return { ok: false as const, error: 'You do not have access to this property.' }
    }
    return { ok: true as const, userId: result.userId, profile: result.profile }
  }

  if (result.profile.hotel_id !== hotelId) {
    return { ok: false as const, error: 'You do not have access to this property.' }
  }
  return { ok: true as const, userId: result.userId, profile: result.profile }
}

export async function updateHotelSettings(input: unknown): Promise<SettingsActionResult> {
  const parsed = updateHotelSettingsSchema.safeParse(input)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message
    return {
      success: false,
      error: msg?.includes('Tax rate') ? msg : (msg ?? 'Invalid input.'),
    }
  }

  const auth = await requireOwnerSettings(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { data: before } = await admin
    .from('hotels')
    .select(
      'name, vat_mode, invoice_prefix, tax_nhil_rate, tax_getfund_rate, tax_vat_rate, tax_elevy_rate, tax_covid_rate, tax_tourism_levy_rate',
    )
    .eq('id', parsed.data.hotelId)
    .maybeSingle()

  const { error } = await admin
    .from('hotels')
    .update({
      name: parsed.data.name.trim(),
      address: parsed.data.address.trim(),
      city: parsed.data.city.trim(),
      region: parsed.data.region.trim(),
      vat_registration_number: parsed.data.vat_registration_number?.trim() || null,
      ...(parsed.data.vat_mode ? { vat_mode: parsed.data.vat_mode } : {}),
      ...(parsed.data.invoice_prefix?.trim()
        ? { invoice_prefix: parsed.data.invoice_prefix.trim().toUpperCase() }
        : {}),
      ...(parsed.data.taxNhilPercent !== undefined
        ? { tax_nhil_rate: parsed.data.taxNhilPercent }
        : {}),
      ...(parsed.data.taxGetfundPercent !== undefined
        ? { tax_getfund_rate: parsed.data.taxGetfundPercent }
        : {}),
      ...(parsed.data.taxVatPercent !== undefined
        ? { tax_vat_rate: parsed.data.taxVatPercent }
        : {}),
      ...(parsed.data.taxElevyPercent !== undefined
        ? { tax_elevy_rate: parsed.data.taxElevyPercent }
        : {}),
      ...(parsed.data.taxCovidPercent !== undefined
        ? { tax_covid_rate: parsed.data.taxCovidPercent }
        : {}),
      ...(parsed.data.taxTourismPercent !== undefined
        ? { tax_tourism_levy_rate: parsed.data.taxTourismPercent }
        : {}),
    })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  const changes: string[] = []
  const trimmedName = parsed.data.name.trim()
  if (before?.name !== trimmedName) changes.push(`Name: ${before?.name ?? '—'} → ${trimmedName}`)
  if (parsed.data.vat_mode && before?.vat_mode !== parsed.data.vat_mode) {
    changes.push(`VAT mode: ${before?.vat_mode ?? 'exclusive'} → ${parsed.data.vat_mode}`)
  }
  const nextPrefix = parsed.data.invoice_prefix?.trim().toUpperCase()
  if (nextPrefix && before?.invoice_prefix !== nextPrefix) {
    changes.push(`Invoice prefix: ${before?.invoice_prefix ?? '—'} → ${nextPrefix}`)
  }
  const rateChanged =
    (parsed.data.taxNhilPercent !== undefined &&
      before?.tax_nhil_rate !== parsed.data.taxNhilPercent) ||
    (parsed.data.taxGetfundPercent !== undefined &&
      before?.tax_getfund_rate !== parsed.data.taxGetfundPercent) ||
    (parsed.data.taxVatPercent !== undefined &&
      before?.tax_vat_rate !== parsed.data.taxVatPercent) ||
    (parsed.data.taxElevyPercent !== undefined &&
      before?.tax_elevy_rate !== parsed.data.taxElevyPercent) ||
    (parsed.data.taxCovidPercent !== undefined &&
      before?.tax_covid_rate !== parsed.data.taxCovidPercent) ||
    (parsed.data.taxTourismPercent !== undefined &&
      before?.tax_tourism_levy_rate !== parsed.data.taxTourismPercent)
  if (rateChanged) changes.push('Tax rates updated')

  void writeAuditLog({
    hotelId: parsed.data.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'hotel',
    entityId: parsed.data.hotelId,
    action: 'settings_updated',
    summary:
      changes.length > 0
        ? `Property settings: ${changes.join('; ')}`
        : 'Property settings saved',
  })

  revalidateSettingsViews()
  return { success: true }
}

export async function updateReservationLifecycleSettings(input: {
  hotelId: string
  holdDurationOnlineMinutes: number
  holdDurationPhoneMinutes: number
  holdDurationAgentMinutes: number
  noShowTime: string
  postStayArchiveDelayDays: number
  noShowChargePolicy: 'none' | 'one_night' | 'full_stay'
  noShowHoldRoom: boolean
  useLifecycleV2: boolean
  timezone: string
  checkInPaymentMode: 'none' | 'percent' | 'fixed' | 'first_night'
  checkInPaymentValue: number
}): Promise<SettingsActionResult> {
  const parsed = updateReservationLifecycleSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const auth = await requireOwnerOrManagerSettings(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('hotels')
    .update({
      hold_duration_online_minutes: parsed.data.holdDurationOnlineMinutes,
      hold_duration_phone_minutes: parsed.data.holdDurationPhoneMinutes,
      hold_duration_agent_minutes: parsed.data.holdDurationAgentMinutes,
      no_show_time: parsed.data.noShowTime,
      post_stay_archive_delay_days: parsed.data.postStayArchiveDelayDays,
      no_show_charge_policy: parsed.data.noShowChargePolicy,
      no_show_hold_room: parsed.data.noShowHoldRoom,
      use_lifecycle_v2: parsed.data.useLifecycleV2,
      timezone: normalizeHotelTimezone(parsed.data.timezone),
      check_in_payment_mode: parsed.data.checkInPaymentMode,
      check_in_payment_value: parsed.data.checkInPaymentValue,
    })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: parsed.data.hotelId,
    actorId: auth.userId,
    actorName: auth.profile.name,
    entityType: 'hotel',
    entityId: parsed.data.hotelId,
    action: 'reservation_lifecycle_settings',
    summary: `Reservation lifecycle settings updated (v2 ${parsed.data.useLifecycleV2 ? 'on' : 'off'}, check-in min ${parsed.data.checkInPaymentMode})`,
  })

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

  const auth = await requireOwnerSettings(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const prefs: NotificationSmsPrefs = {}
  for (const key of NOTIFICATION_TEMPLATE_KEYS) {
    if (typeof parsed.data.prefs[key] === 'boolean') {
      prefs[key] = parsed.data.prefs[key]!
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
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
  notificationFromEmail?: string
}): Promise<SettingsActionResult> {
  const parsed = updateNotificationPrefsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const auth = await requireOwnerSettings(parsed.data.hotelId)
  if (!auth.ok) return { success: false, error: auth.error }

  const prefs: NotificationEmailPrefs = {}
  for (const key of EMAIL_STAFF_TEMPLATE_KEYS) {
    if (typeof parsed.data.prefs[key] === 'boolean') {
      prefs[key] = parsed.data.prefs[key]!
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('hotels')
    .update({
      notification_email_prefs: prefs,
      notification_from_email: parsed.data.notificationFromEmail?.trim() || null,
    })
    .eq('id', parsed.data.hotelId)

  if (error) return { success: false, error: error.message }

  revalidateSettingsViews()
  return { success: true }
}

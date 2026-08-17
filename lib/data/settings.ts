import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { propertyImagePublicUrl } from '@/lib/properties/image-storage'
import type { Hotel, NoShowChargePolicy, VatMode } from '@/types'
import { withInvoiceHotelContact } from '@/lib/export/invoice-hotel-contact'
import type { ExportHotelInfo } from '@/lib/export/types'
import { resolveHotelTaxRates, type HotelTaxRates } from '@/lib/tax'
import {
  mergeNotificationPrefs,
  NOTIFICATION_TEMPLATE_KEYS,
  type NotificationSmsPrefs,
} from '@/lib/notifications/preferences'
import type { NotificationEmailPrefs } from '@/lib/notifications/email-preferences'
import {
  EMAIL_STAFF_TEMPLATE_KEYS,
  mergeEmailPrefs,
} from '@/lib/notifications/email-preferences'
import { normalizeHotelTimezone, DEFAULT_HOTEL_TIMEZONE } from '@/lib/hotel-time'
import {
  normalizeCheckInPaymentPolicy,
  type CheckInPaymentPolicy,
} from '@/lib/billing/check-in-payment-policy'
import type { CheckInPaymentMode } from '@/types'

export interface HotelSettings {
  id: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  vat_registration_number: string | null
  vat_mode: VatMode
  invoice_prefix: string | null
  profileImageUrl: string | null
  roomCount: number
  notificationSmsPrefs: NotificationSmsPrefs
  notificationEmailPrefs: NotificationEmailPrefs
  notificationFromEmail: string | null
  holdDurationOnlineMinutes: number
  holdDurationPhoneMinutes: number
  holdDurationAgentMinutes: number
  noShowTime: string
  postStayArchiveDelayDays: number
  noShowChargePolicy: NoShowChargePolicy
  noShowHoldRoom: boolean
  useLifecycleV2: boolean
  timezone: string
  /** Resolved fractions used for new invoices. */
  taxRates: HotelTaxRates
  /** Raw hotel overrides (null = system default). Percents for UI = rate * 100. */
  taxRateOverrides: {
    nhil: number | null
    getfund: number | null
    vat: number | null
    elevy: number | null
    covid: number | null
    tourism: number | null
  }
  checkInPaymentMode: CheckInPaymentMode
  checkInPaymentValue: number
}

export async function getHotelCheckInPaymentPolicy(hotelId: string): Promise<CheckInPaymentPolicy> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('check_in_payment_mode, check_in_payment_value')
    .eq('id', hotelId)
    .maybeSingle()
  return normalizeCheckInPaymentPolicy(
    data as { check_in_payment_mode?: string | null; check_in_payment_value?: number | null } | null,
  )
}

export async function getActiveHotelSettings(): Promise<HotelSettings | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'owner') return null
  if (!(await ownerOwnsHotel(profile.id, profile.hotel_id))) return null

  const admin = createAdminClient()
  const [{ data: hotel }, { count: roomCount }] = await Promise.all([
    admin.from('hotels').select('*').eq('id', profile.hotel_id).maybeSingle(),
    admin
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', profile.hotel_id),
  ])

  if (!hotel) return null

  const h = hotel as Hotel & {
    notification_sms_prefs?: NotificationSmsPrefs | null
    notification_email_prefs?: NotificationEmailPrefs | null
    hold_duration_online_minutes?: number
    hold_duration_phone_minutes?: number
    hold_duration_agent_minutes?: number
    no_show_time?: string
    post_stay_archive_delay_days?: number
    no_show_charge_policy?: string
    no_show_hold_room?: boolean
    use_lifecycle_v2?: boolean
    timezone?: string
  }
  const storedPrefs = h.notification_sms_prefs ?? null
  const storedEmailPrefs = h.notification_email_prefs ?? null
  const notificationSmsPrefs = Object.fromEntries(
    NOTIFICATION_TEMPLATE_KEYS.map((key) => [key, mergeNotificationPrefs(storedPrefs)[key]]),
  ) as NotificationSmsPrefs
  const notificationEmailPrefs = Object.fromEntries(
    EMAIL_STAFF_TEMPLATE_KEYS.map((key) => [key, mergeEmailPrefs(storedEmailPrefs)[key]]),
  ) as NotificationEmailPrefs

  const rateRow = h as Hotel & {
    tax_nhil_rate?: number | null
    tax_getfund_rate?: number | null
    tax_vat_rate?: number | null
    tax_elevy_rate?: number | null
    tax_covid_rate?: number | null
    tax_tourism_levy_rate?: number | null
  }

  return {
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    region: h.region,
    vat_registration_number: h.vat_registration_number,
    vat_mode: (h.vat_mode ?? 'exclusive') as VatMode,
    invoice_prefix: h.invoice_prefix,
    profileImageUrl: propertyImagePublicUrl(h.profile_image_path),
    roomCount: roomCount ?? 0,
    notificationSmsPrefs,
    notificationEmailPrefs,
    notificationFromEmail: h.notification_from_email ?? null,
    holdDurationOnlineMinutes: h.hold_duration_online_minutes ?? 15,
    holdDurationPhoneMinutes: h.hold_duration_phone_minutes ?? 240,
    holdDurationAgentMinutes: h.hold_duration_agent_minutes ?? 1440,
    noShowTime: h.no_show_time ?? '23:59',
    postStayArchiveDelayDays: h.post_stay_archive_delay_days ?? 30,
    noShowChargePolicy: (h.no_show_charge_policy ?? 'one_night') as NoShowChargePolicy,
    noShowHoldRoom: h.no_show_hold_room ?? false,
    useLifecycleV2: h.use_lifecycle_v2 ?? false,
    timezone: normalizeHotelTimezone(h.timezone ?? DEFAULT_HOTEL_TIMEZONE),
    taxRates: resolveHotelTaxRates(rateRow),
    taxRateOverrides: {
      nhil: rateRow.tax_nhil_rate != null ? Number(rateRow.tax_nhil_rate) : null,
      getfund: rateRow.tax_getfund_rate != null ? Number(rateRow.tax_getfund_rate) : null,
      vat: rateRow.tax_vat_rate != null ? Number(rateRow.tax_vat_rate) : null,
      elevy: rateRow.tax_elevy_rate != null ? Number(rateRow.tax_elevy_rate) : null,
      covid: rateRow.tax_covid_rate != null ? Number(rateRow.tax_covid_rate) : null,
      tourism:
        rateRow.tax_tourism_levy_rate != null ? Number(rateRow.tax_tourism_levy_rate) : null,
    },
    ...(() => {
      const policy = normalizeCheckInPaymentPolicy(h as {
        check_in_payment_mode?: string | null
        check_in_payment_value?: number | null
      })
      return {
        checkInPaymentMode: policy.mode,
        checkInPaymentValue: policy.value,
      }
    })(),
  }
}

export async function getHotelExportInfo(): Promise<ExportHotelInfo | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return null

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select(
      'name, address, city, region, vat_registration_number, vat_mode, notification_from_email, guest_portal_emergency_phone',
    )
    .eq('id', profile.hotel_id)
    .maybeSingle()

  if (!hotel) return null

  return withInvoiceHotelContact({
    name: hotel.name,
    address: hotel.address,
    city: hotel.city,
    region: hotel.region,
    phone: hotel.guest_portal_emergency_phone,
    email: hotel.notification_from_email,
    vatRegistrationNumber: hotel.vat_registration_number,
    vatMode: (hotel.vat_mode ?? 'exclusive') as VatMode,
  })
}

export async function getHotelVatMode(hotelId: string): Promise<VatMode> {
  const admin = createAdminClient()
  const { data } = await admin.from('hotels').select('vat_mode').eq('id', hotelId).maybeSingle()
  return (data?.vat_mode ?? 'exclusive') as VatMode
}

export async function getHotelTaxRates(hotelId: string): Promise<HotelTaxRates> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select(
      'tax_nhil_rate, tax_getfund_rate, tax_vat_rate, tax_elevy_rate, tax_covid_rate, tax_tourism_levy_rate',
    )
    .eq('id', hotelId)
    .maybeSingle()
  return resolveHotelTaxRates(data)
}

export async function getHotelTaxConfig(
  hotelId: string,
): Promise<{ vatMode: VatMode; rates: HotelTaxRates }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select(
      'vat_mode, tax_nhil_rate, tax_getfund_rate, tax_vat_rate, tax_elevy_rate, tax_covid_rate, tax_tourism_levy_rate',
    )
    .eq('id', hotelId)
    .maybeSingle()
  return {
    vatMode: (data?.vat_mode ?? 'exclusive') as VatMode,
    rates: resolveHotelTaxRates(data),
  }
}

import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import { propertyImagePublicUrl } from '@/lib/properties/image-storage'
import type { Hotel, VatMode } from '@/types'
import type { ExportHotelInfo } from '@/lib/export/types'
import {
  mergeNotificationPrefs,
  NOTIFICATION_TEMPLATE_KEYS,
  type NotificationSmsPrefs,
} from '@/lib/notifications/preferences'
import {
  mergeEmailPrefs,
  EMAIL_STAFF_TEMPLATE_KEYS,
  type NotificationEmailPrefs,
} from '@/lib/notifications/email-preferences'

export interface HotelSettings {
  id: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  gta_license_number: string | null
  gta_license_expiry: string | null
  vat_registration_number: string | null
  vat_mode: VatMode
  invoice_prefix: string | null
  profileImageUrl: string | null
  roomCount: number
  notificationSmsPrefs: NotificationSmsPrefs
  notificationEmailPrefs: NotificationEmailPrefs
  notificationFromEmail: string | null
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
  }
  const storedPrefs = h.notification_sms_prefs ?? null
  const storedEmailPrefs = h.notification_email_prefs ?? null
  const notificationSmsPrefs = Object.fromEntries(
    NOTIFICATION_TEMPLATE_KEYS.map((key) => [key, mergeNotificationPrefs(storedPrefs)[key]]),
  ) as NotificationSmsPrefs
  const notificationEmailPrefs = Object.fromEntries(
    EMAIL_STAFF_TEMPLATE_KEYS.map((key) => [key, mergeEmailPrefs(storedEmailPrefs)[key]]),
  ) as NotificationEmailPrefs

  return {
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    region: h.region,
    gta_license_number: h.gta_license_number,
    gta_license_expiry: h.gta_license_expiry,
    vat_registration_number: h.vat_registration_number,
    vat_mode: (h.vat_mode ?? 'exclusive') as VatMode,
    invoice_prefix: h.invoice_prefix,
    profileImageUrl: propertyImagePublicUrl(h.profile_image_path),
    roomCount: roomCount ?? 0,
    notificationSmsPrefs,
    notificationEmailPrefs,
    notificationFromEmail: h.notification_from_email ?? null,
  }
}

export async function getHotelExportInfo(): Promise<ExportHotelInfo | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return null

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('name, address, city, region, vat_registration_number, vat_mode')
    .eq('id', profile.hotel_id)
    .maybeSingle()

  if (!hotel) return null

  return {
    name: hotel.name,
    address: hotel.address,
    city: hotel.city,
    region: hotel.region,
    vatRegistrationNumber: hotel.vat_registration_number,
    vatMode: (hotel.vat_mode ?? 'exclusive') as VatMode,
  }
}

export async function getHotelVatMode(hotelId: string): Promise<VatMode> {
  const admin = createAdminClient()
  const { data } = await admin.from('hotels').select('vat_mode').eq('id', hotelId).maybeSingle()
  return (data?.vat_mode ?? 'exclusive') as VatMode
}

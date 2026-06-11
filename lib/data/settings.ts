import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import type { Hotel } from '@/types'
import type { ExportHotelInfo } from '@/lib/export/types'

export interface HotelSettings {
  id: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  gta_license_number: string | null
  gta_license_expiry: string | null
  vat_registration_number: string | null
  invoice_prefix: string | null
  roomCount: number
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

  const h = hotel as Hotel
  return {
    id: h.id,
    name: h.name,
    address: h.address,
    city: h.city,
    region: h.region,
    gta_license_number: h.gta_license_number,
    gta_license_expiry: h.gta_license_expiry,
    vat_registration_number: h.vat_registration_number,
    invoice_prefix: h.invoice_prefix,
    roomCount: roomCount ?? 0,
  }
}

export async function getHotelExportInfo(): Promise<ExportHotelInfo | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return null

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('name, address, city, region, vat_registration_number')
    .eq('id', profile.hotel_id)
    .maybeSingle()

  if (!hotel) return null

  return {
    name: hotel.name,
    address: hotel.address,
    city: hotel.city,
    region: hotel.region,
    vatRegistrationNumber: hotel.vat_registration_number,
  }
}

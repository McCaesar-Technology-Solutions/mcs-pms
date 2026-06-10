import { getProfile } from '@/lib/auth/get-profile'
import { createAdminClient } from '@/lib/supabase/admin'
import { ownerOwnsHotel } from '@/lib/data/properties'
import type { Hotel } from '@/types'

export interface HotelSettings {
  id: string
  name: string
  address: string | null
  city: string | null
  region: string | null
  gta_license_number: string | null
  gta_license_expiry: string | null
  vat_registration_number: string | null
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
    roomCount: roomCount ?? 0,
  }
}

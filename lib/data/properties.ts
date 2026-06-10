import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/get-profile'
import type { Hotel, Property } from '@/types'

interface HotelWithRooms extends Hotel {
  rooms?: { count: number }[]
}

function hotelToProperty(hotel: HotelWithRooms): Property {
  const roomCount = hotel.rooms?.[0]?.count ?? 0
  const code = hotel.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'MOJO'

  return {
    id: hotel.id,
    name: hotel.name,
    code,
    address: hotel.address ?? '',
    city: hotel.city ?? 'Accra',
    region: hotel.region ?? 'Greater Accra',
    totalRooms: roomCount,
  }
}

/** Hotels owned by the signed-in owner, with live room counts. */
export async function getOwnerProperties(): Promise<Property[]> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'owner') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('hotels')
    .select('*, rooms(count)')
    .eq('owner_id', profile.id)
    .order('name')

  return ((data ?? []) as unknown as HotelWithRooms[]).map(hotelToProperty)
}

/** Single assigned hotel for managers/technicians. */
export async function getAssignedProperty(): Promise<Property | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('hotels')
    .select('*, rooms(count)')
    .eq('id', profile.hotel_id)
    .maybeSingle()

  if (!data) return null
  return hotelToProperty(data as unknown as HotelWithRooms)
}

export async function ownerOwnsHotel(ownerId: string, hotelId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('hotels')
    .select('id')
    .eq('id', hotelId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  return Boolean(data)
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth/get-profile'
import type { Hotel, Property } from '@/types'

async function getRoomCount(hotelId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotelId)
  return count ?? 0
}

function hotelToProperty(hotel: Hotel, roomCount: number): Property {
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

  const admin = createAdminClient()
  const { data: owned } = await admin
    .from('hotels')
    .select('*, rooms(count)')
    .eq('owner_id', profile.id)
    .order('name')

  const byId = new Map<string, Hotel>()
  for (const row of (owned ?? []) as Hotel[]) {
    byId.set(row.id, row)
  }

  // Include the active hotel even if owner_id was not backfilled yet (legacy rows).
  if (profile.hotel_id && !byId.has(profile.hotel_id)) {
    const { data: active } = await admin
      .from('hotels')
      .select('*')
      .eq('id', profile.hotel_id)
      .maybeSingle()

    if (active) {
      const hotel = active as Hotel
      byId.set(hotel.id, hotel)
      if (!hotel.owner_id) {
        await admin.from('hotels').update({ owner_id: profile.id }).eq('id', hotel.id)
      }
    }
  }

  const hotels = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  const counts = await Promise.all(hotels.map((h) => getRoomCount(h.id)))
  return hotels.map((hotel, i) => hotelToProperty(hotel, counts[i]))
}

/** Single assigned hotel for managers/technicians. */
export async function getAssignedProperty(): Promise<Property | null> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return null

  const supabase = await createClient()
  const { data } = await supabase.from('hotels').select('*').eq('id', profile.hotel_id).maybeSingle()

  if (!data) return null
  const roomCount = await getRoomCount(data.id)
  return hotelToProperty(data as Hotel, roomCount)
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

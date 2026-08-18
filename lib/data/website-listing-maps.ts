import { createAdminClient } from '@/lib/supabase/admin'

export interface WebsiteListingMapView {
  id: string
  hotelId: string
  roomId: string | null
  roomNumber: string | null
  websitePropertyId: string
  websiteSlug: string | null
  isActive: boolean
}

export async function getWebsiteListingMaps(hotelId: string): Promise<WebsiteListingMapView[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('website_listing_maps')
    .select('id, hotel_id, room_id, website_property_id, website_slug, is_active, rooms(number)')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map((row) => {
    const roomsJoin = row.rooms as { number?: string } | { number?: string }[] | null
    const rooms = Array.isArray(roomsJoin) ? roomsJoin[0] : roomsJoin
    return {
      id: row.id,
      hotelId: row.hotel_id,
      roomId: row.room_id,
      roomNumber: rooms?.number ?? null,
      websitePropertyId: row.website_property_id,
      websiteSlug: row.website_slug,
      isActive: row.is_active,
    }
  })
}

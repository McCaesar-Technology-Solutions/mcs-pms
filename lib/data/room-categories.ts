import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth/get-profile'
import type { RoomCategory } from '@/types'

type AdminClient = SupabaseClient<Database>

export async function getRoomCategories(): Promise<RoomCategory[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('room_categories')
    .select('*')
    .eq('hotel_id', profile.hotel_id)
    .order('name')

  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    hotel_id: row.hotel_id,
    name: row.name,
    default_nightly_rate: Number(row.default_nightly_rate),
    default_monthly_rate:
      row.default_monthly_rate != null ? Number(row.default_monthly_rate) : null,
    created_at: row.created_at,
  }))
}

export const DEFAULT_ROOM_CATEGORIES = [
  { name: 'Standard', default_nightly_rate: 250 },
  { name: 'Deluxe', default_nightly_rate: 380 },
  { name: 'Suite', default_nightly_rate: 550 },
] as const

/** Seed default categories when a new hotel is created (service role). */
export async function seedDefaultRoomCategories(
  admin: AdminClient,
  hotelId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('room_categories')
    .insert(
      DEFAULT_ROOM_CATEGORIES.map((c) => ({
        hotel_id: hotelId,
        name: c.name,
        default_nightly_rate: c.default_nightly_rate,
      })),
    )
    .select('id')
    .limit(1)

  if (error) {
    // Idempotent if migration already inserted defaults
    const { data: existing } = await admin
      .from('room_categories')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('name', 'Standard')
      .maybeSingle()
    return existing?.id ?? null
  }

  return data?.[0]?.id ?? null
}

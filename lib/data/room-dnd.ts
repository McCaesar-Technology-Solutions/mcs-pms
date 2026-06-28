import { createAdminClient } from '@/lib/supabase/admin'
import { todayISO } from '@/lib/stays/helpers'

/** Room IDs where an in-house guest currently has Do Not Disturb enabled. */
export async function loadActiveDndRoomIds(hotelId: string): Promise<Set<string>> {
  const admin = createAdminClient()
  const today = todayISO()
  const { data } = await admin
    .from('guests')
    .select('room_id')
    .eq('hotel_id', hotelId)
    .eq('do_not_disturb', true)
    .not('room_id', 'is', null)
    .lte('check_in', today)
    .gte('check_out', today)

  return new Set(
    (data ?? [])
      .map((row) => row.room_id)
      .filter((id): id is string => Boolean(id)),
  )
}

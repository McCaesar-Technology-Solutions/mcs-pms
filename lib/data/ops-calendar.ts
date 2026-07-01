import { createAdminClient } from '@/lib/supabase/admin'
import { OPS_EVENT_LABELS } from '@/lib/ops-calendar/categories'

export { OPS_EVENT_LABELS }

export interface OpsCalendarEventRow {
  id: string
  title: string
  category: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  roomNumber: string | null
  notes: string | null
}

export function opsCalendarWeekRange(): { fromIso: string; toIso: string } {
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return { fromIso: weekStart.toISOString(), toIso: weekEnd.toISOString() }
}

export async function loadOpsCalendarEvents(
  hotelId: string,
  fromIso: string,
  toIso: string,
): Promise<OpsCalendarEventRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('ops_calendar_events')
    .select('id, title, category, starts_at, ends_at, all_day, notes, rooms(number)')
    .eq('hotel_id', hotelId)
    .gte('starts_at', fromIso)
    .lte('starts_at', toIso)
    .order('starts_at')

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    roomNumber: (row.rooms as { number?: string } | null)?.number ?? null,
    notes: row.notes,
  }))
}

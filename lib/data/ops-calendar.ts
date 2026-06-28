import { createAdminClient } from '@/lib/supabase/admin'

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

export const OPS_EVENT_LABELS: Record<string, string> = {
  training: 'Training',
  meeting: 'Meeting',
  guest_service: 'Guest service',
  maintenance: 'Maintenance',
  event: 'Event',
  general: 'General',
}

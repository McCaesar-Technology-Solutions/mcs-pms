import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export function guestRequestTaskMarker(guestRequestId: string): string {
  return `[guest-request:${guestRequestId}]`
}

export function parseGuestRequestIdFromNotes(notes: string | null | undefined): string | null {
  const match = notes?.match(/\[guest-request:([^\]]+)\]/)
  return match?.[1] ?? null
}

export type GuestRequestHousekeepingTask = { id: string; status: string }

export async function findGuestHousekeepingTask(
  admin: AdminClient,
  hotelId: string,
  guestRequestId: string,
): Promise<GuestRequestHousekeepingTask | null> {
  const marker = guestRequestTaskMarker(guestRequestId)
  const { data } = await admin
    .from('housekeeping_tasks')
    .select('id, status')
    .eq('hotel_id', hotelId)
    .ilike('notes', `%${marker}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  return data?.[0] ?? null
}

/** Map guest request id → linked housekeeping task for a property. */
export async function loadGuestRequestHousekeepingTasks(
  admin: AdminClient,
  hotelId: string,
): Promise<Map<string, GuestRequestHousekeepingTask>> {
  const { data } = await admin
    .from('housekeeping_tasks')
    .select('id, status, notes, created_at')
    .eq('hotel_id', hotelId)
    .ilike('notes', '%[guest-request:%')
    .order('created_at', { ascending: false })

  const map = new Map<string, GuestRequestHousekeepingTask>()
  for (const task of data ?? []) {
    const requestId = parseGuestRequestIdFromNotes(task.notes)
    if (!requestId || map.has(requestId)) continue
    map.set(requestId, { id: task.id, status: task.status })
  }
  return map
}

/** Create a housekeeping task from a guest portal request (idempotent per request). */
export async function createGuestHousekeepingTask(
  admin: AdminClient,
  input: {
    hotelId: string
    roomId: string
    guestId: string
    note: string | null
    createdBy?: string
    guestRequestId?: string
  },
): Promise<{ created: boolean; taskId?: string }> {
  if (input.guestRequestId) {
    const existing = await findGuestHousekeepingTask(admin, input.hotelId, input.guestRequestId)
    if (existing) {
      return { created: false, taskId: existing.id }
    }
  }

  const { data: guest } = await admin
    .from('guests')
    .select('do_not_disturb')
    .eq('id', input.guestId)
    .maybeSingle()

  const noteParts = [
    input.note?.trim(),
    guest?.do_not_disturb ? 'Guest has Do Not Disturb on — call before entering.' : null,
    input.guestRequestId ? guestRequestTaskMarker(input.guestRequestId) : null,
  ].filter(Boolean)

  const { data: inserted, error } = await admin
    .from('housekeeping_tasks')
    .insert({
      hotel_id: input.hotelId,
      room_id: input.roomId,
      task_type: 'clean',
      priority: 'medium',
      notes: noteParts.length > 0 ? noteParts.join(' ') : 'Guest portal housekeeping request',
      status: 'todo',
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()

  if (error || !inserted) return { created: false }
  return { created: true, taskId: inserted.id }
}

import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

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
    const marker = `[guest-request:${input.guestRequestId}]`
    const { data: existing } = await admin
      .from('housekeeping_tasks')
      .select('id')
      .eq('hotel_id', input.hotelId)
      .eq('room_id', input.roomId)
      .ilike('notes', `%${marker}%`)
      .limit(1)

    if (existing && existing.length > 0) {
      return { created: false, taskId: existing[0].id }
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
    input.guestRequestId ? `[guest-request:${input.guestRequestId}]` : null,
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

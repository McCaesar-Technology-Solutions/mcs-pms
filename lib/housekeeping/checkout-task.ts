import type { createAdminClient } from '@/lib/supabase/admin'
import { todayISO } from '@/lib/stays/helpers'

type AdminClient = ReturnType<typeof createAdminClient>

export async function createPostCheckoutCleanTask(
  admin: AdminClient,
  input: {
    hotelId: string
    roomId: string
    guestName: string
    createdBy: string
    notes?: string
  },
): Promise<void> {
  const { data: existing } = await admin
    .from('housekeeping_tasks')
    .select('id')
    .eq('hotel_id', input.hotelId)
    .eq('room_id', input.roomId)
    .eq('task_type', 'clean')
    .neq('status', 'done')
    .limit(1)

  if (existing && existing.length > 0) return

  await admin.from('housekeeping_tasks').insert({
    hotel_id: input.hotelId,
    room_id: input.roomId,
    task_type: 'clean',
    status: 'todo',
    priority: 'high',
    assigned_to: null,
    notes: input.notes ?? `Post checkout — ${input.guestName}`,
    created_by: input.createdBy,
    due_date: todayISO(),
  })
}

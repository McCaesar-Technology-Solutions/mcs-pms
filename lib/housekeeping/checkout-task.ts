import type { createAdminClient } from '@/lib/supabase/admin'
import { todayISO } from '@/lib/stays/helpers'

type AdminClient = ReturnType<typeof createAdminClient>

async function findHousekeepingAssignee(
  admin: AdminClient,
  hotelId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('id')
    .eq('hotel_id', hotelId)
    .eq('role', 'technician')
    .eq('is_active', true)
    .order('created_at')
    .limit(1)

  return data?.[0]?.id ?? null
}

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
  const assignee = await findHousekeepingAssignee(admin, input.hotelId)

  const { data: existing } = await admin
    .from('housekeeping_tasks')
    .select('id')
    .eq('hotel_id', input.hotelId)
    .eq('room_id', input.roomId)
    .eq('task_type', 'clean')
    .neq('status', 'done')
    .limit(1)

  if (existing && existing.length > 0) return

  const { data: inserted } = await admin
    .from('housekeeping_tasks')
    .insert({
      hotel_id: input.hotelId,
      room_id: input.roomId,
      task_type: 'clean',
      status: 'todo',
      priority: 'high',
      assigned_to: assignee,
      notes: input.notes ?? `Post checkout — ${input.guestName}`,
      created_by: input.createdBy,
      due_date: todayISO(),
    })
    .select('id')
    .single()

  if (assignee && inserted?.id) {
    void import('@/lib/notifications/housekeeping').then(({ notifyHousekeepingTaskAssigned }) =>
      notifyHousekeepingTaskAssigned(inserted.id).catch(() => undefined),
    )
  }
}

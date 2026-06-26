import type { createAdminClient } from '@/lib/supabase/admin'
import { todayISO } from '@/lib/stays/helpers'
import type { HousekeepingTaskType, TaskStatus } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

export async function applyHousekeepingSideEffects(
  admin: AdminClient,
  input: {
    hotelId: string
    taskId: string
    roomId: string | null
    taskType: HousekeepingTaskType
    newStatus: TaskStatus
    actorId: string
  },
): Promise<{ inspectTaskId?: string }> {
  if (input.newStatus !== 'done' || !input.roomId) return {}

  const now = new Date().toISOString()

  if (input.taskType === 'clean') {
    await admin
      .from('rooms')
      .update({
        status: 'needs_inspection',
        updated_by: input.actorId,
        updated_at: now,
      })
      .eq('id', input.roomId)
      .eq('hotel_id', input.hotelId)

    const { data: existingInspect } = await admin
      .from('housekeeping_tasks')
      .select('id')
      .eq('hotel_id', input.hotelId)
      .eq('room_id', input.roomId)
      .eq('task_type', 'inspect')
      .neq('status', 'done')
      .limit(1)

    if (existingInspect && existingInspect.length > 0) return {}

    const { data: inserted } = await admin
      .from('housekeeping_tasks')
      .insert({
        hotel_id: input.hotelId,
        room_id: input.roomId,
        task_type: 'inspect',
        status: 'todo',
        priority: 'high',
        notes: 'Post-clean inspection — verify room before marking available',
        created_by: input.actorId,
        due_date: todayISO(),
      })
      .select('id')
      .single()

    return { inspectTaskId: inserted?.id }
  }

  if (input.taskType === 'inspect') {
    await admin
      .from('rooms')
      .update({
        status: 'available',
        updated_by: input.actorId,
        updated_at: now,
      })
      .eq('id', input.roomId)
      .eq('hotel_id', input.hotelId)
  }

  return {}
}

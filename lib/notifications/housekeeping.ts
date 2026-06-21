import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPhones } from '@/lib/notifications/send'
import { appUrl } from '@/lib/notifications/app-url'
import type { HousekeepingTaskType } from '@/types'

const TASK_LABELS: Record<HousekeepingTaskType, string> = {
  clean: 'Clean',
  inspect: 'Inspect',
  maintenance: 'Maintenance',
  restock: 'Restock',
}

async function assigneePhone(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('phone').eq('id', userId).maybeSingle()
  return data?.phone?.trim() ?? null
}

/** Housekeeping or maintenance task assigned — alert assignee (technician/staff). */
export async function notifyHousekeepingTaskAssigned(taskId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: task } = await admin
    .from('housekeeping_tasks')
    .select('hotel_id, task_type, priority, notes, assigned_to, rooms(number)')
    .eq('id', taskId)
    .maybeSingle()

  if (!task?.assigned_to) return

  const phone = await assigneePhone(task.assigned_to)
  if (!phone) return

  const room = task.rooms as { number?: string } | null
  const roomLine = room?.number ? `Room ${room.number}` : 'No room'
  const label = TASK_LABELS[task.task_type as HousekeepingTaskType] ?? task.task_type
  const note = task.notes ? `\n${task.notes.slice(0, 100)}` : ''

  const body = [
    `MOJO: New ${label.toLowerCase()} task [${task.priority}]`,
    roomLine,
    note.trim(),
    appUrl('/technician/tasks'),
  ]
    .filter(Boolean)
    .join('\n')

  await notifyPhones([phone], body, {
    hotelId: task.hotel_id,
    templateKey: 'housekeeping_assigned',
    includeWhatsApp: false,
  })
}

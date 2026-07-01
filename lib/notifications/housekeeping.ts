import { notifyPhones } from '@/lib/notifications/send'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'
import { smsLine, smsRoom, smsTruncate, smsUrl } from '@/lib/notifications/sms-format'
import type { HousekeepingTaskType } from '@/types'

const TASK_LABELS: Record<HousekeepingTaskType, string> = {
  clean: 'Clean',
  inspect: 'Inspect',
  maintenance: 'Maint',
  restock: 'Restock',
}

async function assigneePhone(userId: string): Promise<string | null> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('phone').eq('id', userId).maybeSingle()
  return data?.phone?.trim() ?? null
}

/** Housekeeping or maintenance task assigned — alert assignee (technician/staff). */
export async function notifyHousekeepingTaskAssigned(taskId: string): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
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
  const label = TASK_LABELS[task.task_type as HousekeepingTaskType] ?? task.task_type
  const note = task.notes ? smsTruncate(task.notes, 60) : null

  const body = smsLine(
    'MOJO:',
    `${label} [${task.priority}]`,
    smsRoom(room?.number),
    note ? `- ${note}` : null,
    smsUrl('/technician/tasks'),
  )

  await notifyPhones([phone], body, phoneNotifyOpts('housekeeping_assigned', { hotelId: task.hotel_id }))
}

/** Clean task marked done — room needs inspection; alert managers to verify. */
export async function notifyHousekeepingCleanCompleted(input: {
  taskId: string
  hotelId: string
  roomId: string | null
  priority: string
  completedByName: string
  inspectTaskId?: string
}): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { notifyManagers } = await import('@/lib/notifications/manager-notify')
  const { appUrl } = await import('@/lib/notifications/app-url')
  const admin = createAdminClient()

  let roomNumber: string | undefined
  if (input.roomId) {
    const { data: room } = await admin.from('rooms').select('number').eq('id', input.roomId).maybeSingle()
    roomNumber = room?.number
  }

  const smsBody = smsLine(
    'MOJO:',
    'Clean done',
    smsRoom(roomNumber),
    `- ${input.completedByName}`,
    'Needs inspection',
    smsUrl('/manager/housekeeping'),
  )

  await notifyManagers({
    hotelId: input.hotelId,
    templateKey: 'housekeeping_clean_done',
    smsBody,
    email: {
      subject: `Room ${roomNumber ?? '?'} ready for inspection`,
      preview: `${input.completedByName} finished cleaning${roomNumber ? ` room ${roomNumber}` : ''}.`,
      lines: [
        `${input.completedByName} finished cleaning${roomNumber ? ` room ${roomNumber}` : ''}.`,
        'An inspection task was created — approve before marking the room available.',
      ],
      actionUrl: appUrl('/manager/housekeeping'),
      actionLabel: 'Open housekeeping board',
    },
  })
}

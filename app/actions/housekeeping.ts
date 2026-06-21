'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createHousekeepingTaskSchema } from '@/lib/validations'
import type { HousekeepingTaskType, Profile, TaskPriority, TaskStatus } from '@/types'

export type HousekeepingActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireStaff(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null
  return profile as Profile
}

async function requireManager(): Promise<Profile | null> {
  const profile = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role)) return null
  return profile
}

function revalidate() {
  revalidatePath('/manager/housekeeping')
  revalidatePath('/manager/dashboard')
  revalidatePath('/owner/dashboard')
  revalidatePath('/mobile/housekeeping')
  revalidatePath('/owner/rooms')
  revalidatePath('/manager/rooms')
  revalidatePath('/technician/tasks')
}

export async function createHousekeepingTask(input: {
  roomId: string
  taskType: HousekeepingTaskType
  priority?: TaskPriority
  assignedTo?: string
  dueDate?: string
  notes?: string
}): Promise<HousekeepingActionResult> {
  const parsed = createHousekeepingTaskSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid task.' }
  }

  const profile = await requireManager()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('housekeeping_tasks')
    .insert({
      hotel_id: profile.hotel_id,
      room_id: parsed.data.roomId,
      task_type: parsed.data.taskType,
      priority: parsed.data.priority,
      assigned_to: parsed.data.assignedTo ? parsed.data.assignedTo : null,
      due_date: parsed.data.dueDate ? parsed.data.dueDate : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: 'Could not create the task.' }

  if (parsed.data.assignedTo) {
    void import('@/lib/notifications/housekeeping').then(({ notifyHousekeepingTaskAssigned }) =>
      notifyHousekeepingTaskAssigned(data.id).catch(() => undefined),
    )
  }

  revalidate()
  return { success: true }
}

export async function assignHousekeepingTask(
  taskId: string,
  assigneeId: string | null,
): Promise<HousekeepingActionResult> {
  const profile = await requireManager()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({ assigned_to: assigneeId })
    .eq('id', taskId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not assign the task.' }

  if (assigneeId) {
    void import('@/lib/notifications/housekeeping').then(({ notifyHousekeepingTaskAssigned }) =>
      notifyHousekeepingTaskAssigned(taskId).catch(() => undefined),
    )
  }

  revalidate()
  return { success: true }
}

export async function setHousekeepingTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<HousekeepingActionResult> {
  const profile = await requireStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const supabase = await createClient()
  const { data: task } = await supabase
    .from('housekeeping_tasks')
    .select('id, room_id, task_type, assigned_to')
    .eq('id', taskId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!task) return { success: false, error: 'Task not found.' }

  if (profile.role === 'technician') {
    if (task.assigned_to !== profile.id) {
      return { success: false, error: 'Not authorized.' }
    }
  } else if (!['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not update the task.' }

  if (
    status === 'done' &&
    task.task_type === 'clean' &&
    task.room_id &&
    ['owner', 'manager'].includes(profile.role)
  ) {
    await supabase
      .from('rooms')
      .update({
        status: 'available',
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', task.room_id)
      .eq('hotel_id', profile.hotel_id)
  }

  revalidate()
  return { success: true }
}

export async function deleteHousekeepingTask(
  taskId: string,
): Promise<HousekeepingActionResult> {
  const profile = await requireManager()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('housekeeping_tasks')
    .delete()
    .eq('id', taskId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not delete the task.' }

  revalidate()
  return { success: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadVerifiedStaffProfile, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { applyHousekeepingSideEffects } from '@/lib/housekeeping/side-effects'
import { recordInventoryUsageLines, validateInventoryUsageLines } from '@/lib/inventory/movements'
import { canTransition, statusUpdateFields } from '@/lib/housekeeping/task-flow'
import { createHousekeepingTaskSchema } from '@/lib/validations'
import type { HousekeepingTaskType, Profile, TaskPriority, TaskStatus } from '@/types'
import { runNotifyTask } from '@/lib/notifications/notify-task'

export type HousekeepingActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireStaff(): Promise<Profile | null> {
  return loadVerifiedStaffProfile()
}

async function requireManager(): Promise<Profile | null> {
  return loadVerifiedStaffProfile({ roles: ['owner', 'manager'] })
}

function isManagerRole(role: string): boolean {
  return role === 'owner' || role === 'manager'
}

function revalidate() {
  revalidatePath('/manager/housekeeping')
  revalidatePath('/owner/housekeeping')
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
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('id', parsed.data.roomId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!room) return { success: false, error: 'Room not found at this property.' }

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
      runNotifyTask(notifyHousekeepingTaskAssigned(data.id), {
        templateKey: 'housekeeping_assigned',
        hotelId: profile.hotel_id ?? undefined,
      }),
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
      runNotifyTask(notifyHousekeepingTaskAssigned(taskId), {
        templateKey: 'housekeeping_assigned',
        hotelId: profile.hotel_id ?? undefined,
      }),
    )
  }

  revalidate()
  return { success: true }
}

/** Technician self-assigns an unassigned open task. */
export async function claimHousekeepingTask(taskId: string): Promise<HousekeepingActionResult> {
  const profile = await requireStaff()
  if (!profile?.hotel_id || profile.role !== 'technician') {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: task } = await admin
    .from('housekeeping_tasks')
    .select('id, status, assigned_to')
    .eq('id', taskId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!task) return { success: false, error: 'Task not found.' }
  if (task.assigned_to) return { success: false, error: 'Task is already assigned.' }
  if (task.status === 'done') return { success: false, error: 'Task is already complete.' }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('housekeeping_tasks')
    .update({
      assigned_to: profile.id,
      status: 'in_progress',
      started_at: now,
    })
    .eq('id', taskId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not claim the task.' }

  revalidate()
  return { success: true }
}

export async function setHousekeepingTaskStatus(
  taskId: string,
  status: TaskStatus,
  options?: {
    managerOverride?: boolean
    inventoryLines?: { itemId: string; quantity: number }[]
  },
): Promise<HousekeepingActionResult> {
  const profile = await requireStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }
  const hotelId = profile.hotel_id

  const supabase = await createClient()
  const { data: task } = await supabase
    .from('housekeeping_tasks')
    .select('id, room_id, task_type, assigned_to, status, priority')
    .eq('id', taskId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!task) return { success: false, error: 'Task not found.' }

  const currentStatus = task.status as TaskStatus
  const isManager = isManagerRole(profile.role)

  if (profile.role === 'technician') {
    if (task.assigned_to !== profile.id) {
      return { success: false, error: 'Only the assigned technician can update this task.' }
    }
  } else if (!isManager) {
    return { success: false, error: 'Not authorized.' }
  }

  const managerOverride = isManager && (options?.managerOverride ?? task.assigned_to !== profile.id)

  if (!canTransition(currentStatus, status, isManager)) {
    return { success: false, error: 'That status change is not allowed.' }
  }

  const extraFields = statusUpdateFields(currentStatus, status, profile.id)
  const updatePayload = {
    status,
    ...extraFields,
  }

  const admin = createAdminClient()
  if (
    status === 'done' &&
    options?.inventoryLines &&
    options.inventoryLines.length > 0 &&
    (task.task_type === 'clean' || task.task_type === 'restock')
  ) {
    const validation = await validateInventoryUsageLines(admin, hotelId, options.inventoryLines)
    if (!validation.ok) return { success: false, error: validation.error }
  }

  const { error } = await supabase
    .from('housekeeping_tasks')
    .update(updatePayload)
    .eq('id', taskId)
    .eq('hotel_id', hotelId)

  if (error) return { success: false, error: 'Could not update the task.' }

  if (status === 'done') {
    const sideEffect = await applyHousekeepingSideEffects(admin, {
      hotelId,
      taskId: task.id,
      roomId: task.room_id,
      taskType: task.task_type as HousekeepingTaskType,
      newStatus: status,
      actorId: profile.id,
    })

    // Accrue payroll commissions: assignee when set (piece-rate), else completer
    try {
      const { accrueHousekeepingCommissions } = await import('@/lib/payroll/commissions')
      const earnerId = task.assigned_to ?? profile.id
      let roomLabel: string | null = null
      if (task.room_id) {
        const { data: room } = await admin
          .from('rooms')
          .select('number')
          .eq('id', task.room_id)
          .maybeSingle()
        roomLabel = room?.number != null ? String(room.number) : null
      }
      let earnerRole: typeof profile.role | null = profile.role
      if (earnerId !== profile.id) {
        const { data: earner } = await admin
          .from('profiles')
          .select('role')
          .eq('id', earnerId)
          .maybeSingle()
        earnerRole = (earner?.role as typeof profile.role) ?? null
      }
      await accrueHousekeepingCommissions(admin, {
        hotelId,
        taskId: task.id,
        taskType: task.task_type as HousekeepingTaskType,
        earnerProfileId: earnerId,
        earnerRole,
        roomLabel,
      })
    } catch (err) {
      console.error('[payroll] housekeeping commission accrual error', err)
    }

    if (
      options?.inventoryLines &&
      options.inventoryLines.length > 0 &&
      (task.task_type === 'clean' || task.task_type === 'restock')
    ) {
      const usage = await recordInventoryUsageLines(admin, {
        hotelId,
        lines: options.inventoryLines,
        reason: task.task_type === 'clean' ? 'clean' : 'restock',
        createdBy: profile.id,
        housekeepingTaskId: task.id,
        note:
          task.task_type === 'clean'
            ? 'Supplies used on room turnover'
            : 'Items restocked to room',
      })
      if (!usage.ok) {
        return { success: false, error: usage.error }
      }
      revalidatePath('/owner/inventory')
      revalidatePath('/manager/inventory')
      revalidatePath('/receptionist/inventory')
    }

    if (task.task_type === 'clean') {
      void import('@/lib/notifications/housekeeping').then(({ notifyHousekeepingCleanCompleted }) =>
        runNotifyTask(
          notifyHousekeepingCleanCompleted({
            taskId: task.id,
            hotelId,
            roomId: task.room_id,
            priority: task.priority,
            completedByName: profile.name,
            inspectTaskId: sideEffect.inspectTaskId,
          }),
          {
            templateKey: 'housekeeping_clean_done',
            hotelId,
          },
        ),
      )
    }
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

import { getProfile } from '@/lib/auth/get-profile'
import { isTaskOverdue } from '@/lib/housekeeping/task-flow'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import { createClient } from '@/lib/supabase/server'
import type { DbHousekeepingTask, TaskPriority, TaskStatus } from '@/types'

export type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
export { countNeedsInspectionTasks, countOverdueTasks, groupOpenTasksByRoom } from '@/lib/housekeeping/task-view'

interface TaskRow extends DbHousekeepingTask {
  rooms?: { number: string } | null
}

function mapTaskRow(row: TaskRow): HousekeepingTaskView {
  const status = row.status as TaskStatus
  return {
    id: row.id,
    roomId: row.room_id,
    roomNumber: row.rooms?.number ?? null,
    taskType: row.task_type,
    status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    notes: row.notes,
    dueDate: row.due_date,
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at,
    completedBy: row.completed_by ?? null,
    isOverdue: isTaskOverdue(row.due_date, status),
  }
}

export async function getHousekeepingTasks(): Promise<HousekeepingTaskView[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(number)')
    .eq('hotel_id', profile.hotel_id)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as TaskRow[]
  return rows.map(mapTaskRow)
}

/** Housekeeping tasks assigned to the current technician. */
export async function getAssignedHousekeepingTasks(): Promise<HousekeepingTaskView[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'technician') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(number)')
    .eq('hotel_id', profile.hotel_id)
    .eq('assigned_to', profile.id)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as TaskRow[]
  return rows.map(mapTaskRow)
}

/** Open unassigned tasks the technician can claim. */
export async function getUnassignedHousekeepingTasks(): Promise<HousekeepingTaskView[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'technician') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('housekeeping_tasks')
    .select('*, rooms(number)')
    .eq('hotel_id', profile.hotel_id)
    .is('assigned_to', null)
    .neq('status', 'done')
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as unknown as TaskRow[]
  const mapped = rows.map(mapTaskRow)
  return mapped.sort((a, b) => taskPriorityRank(a.priority) - taskPriorityRank(b.priority))
}

function taskPriorityRank(priority: TaskPriority): number {
  if (priority === 'high') return 0
  if (priority === 'medium') return 1
  return 2
}

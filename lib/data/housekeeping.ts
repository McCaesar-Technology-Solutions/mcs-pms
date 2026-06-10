import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import type { DbHousekeepingTask, HousekeepingTaskType, TaskPriority, TaskStatus } from '@/types'

export interface HousekeepingTaskView {
  id: string
  roomId: string | null
  roomNumber: string | null
  taskType: HousekeepingTaskType
  status: TaskStatus
  priority: TaskPriority
  assignedTo: string | null
  notes: string | null
  dueDate: string | null
  createdAt: string | null
}

interface TaskRow extends DbHousekeepingTask {
  rooms?: { number: string } | null
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

  return rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    roomNumber: row.rooms?.number ?? null,
    taskType: row.task_type,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to,
    notes: row.notes,
    dueDate: row.due_date,
    createdAt: row.created_at,
  }))
}

import type { HousekeepingTaskType, TaskPriority, TaskStatus } from '@/types'

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
  startedAt: string | null
  completedAt: string | null
  completedBy: string | null
  isOverdue: boolean
  roomDoNotDisturb?: boolean
}

function taskPriorityRank(priority: TaskPriority): number {
  if (priority === 'high') return 0
  if (priority === 'medium') return 1
  return 2
}

export function groupOpenTasksByRoom(tasks: HousekeepingTaskView[]): Map<string, HousekeepingTaskView> {
  const map = new Map<string, HousekeepingTaskView>()
  for (const task of tasks) {
    if (!task.roomId || task.status === 'done') continue
    const existing = map.get(task.roomId)
    if (!existing || taskPriorityRank(task.priority) < taskPriorityRank(existing.priority)) {
      map.set(task.roomId, task)
    }
  }
  return map
}

export function countOverdueTasks(tasks: HousekeepingTaskView[]): number {
  return tasks.filter((t) => t.isOverdue).length
}

export function countNeedsInspectionTasks(tasks: HousekeepingTaskView[]): number {
  return tasks.filter((t) => t.taskType === 'inspect' && t.status !== 'done').length
}

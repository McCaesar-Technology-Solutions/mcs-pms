import type { TaskStatus } from '@/types'

/** Allowed status moves for assignees (technicians). Forward-only. */
export const STAFF_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['done'],
  done: [],
}

/** Managers/owners can move tasks in any direction (override). */
export const MANAGER_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress', 'done'],
  in_progress: ['todo', 'done'],
  done: ['todo', 'in_progress'],
}

export function canTransition(
  from: TaskStatus,
  to: TaskStatus,
  isManagerOverride: boolean,
): boolean {
  if (from === to) return false
  const allowed = isManagerOverride ? MANAGER_TRANSITIONS[from] : STAFF_TRANSITIONS[from]
  return allowed.includes(to)
}

export function statusUpdateFields(
  from: TaskStatus,
  to: TaskStatus,
  userId: string,
): {
  started_at?: string
  completed_at?: string | null
  completed_by?: string | null
} {
  const fields: {
    started_at?: string
    completed_at?: string | null
    completed_by?: string | null
  } = {}

  if (to === 'in_progress' && from === 'todo') {
    fields.started_at = new Date().toISOString()
  }
  if (to === 'done') {
    fields.completed_at = new Date().toISOString()
    fields.completed_by = userId
  }
  if (from === 'done' && to !== 'done') {
    fields.completed_at = null
    fields.completed_by = null
  }
  return fields
}

export function isTaskOverdue(dueDate: string | null, status: TaskStatus): boolean {
  if (!dueDate || status === 'done') return false
  const today = new Date().toISOString().split('T')[0]
  return dueDate < today
}

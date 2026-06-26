import { describe, expect, it } from 'vitest'
import {
  canTransition,
  isTaskOverdue,
  statusUpdateFields,
  STAFF_TRANSITIONS,
} from '@/lib/housekeeping/task-flow'

describe('housekeeping task flow', () => {
  it('allows staff forward-only transitions', () => {
    expect(canTransition('todo', 'in_progress', false)).toBe(true)
    expect(canTransition('in_progress', 'done', false)).toBe(true)
    expect(canTransition('todo', 'done', false)).toBe(false)
    expect(canTransition('done', 'todo', false)).toBe(false)
  })

  it('allows manager override transitions', () => {
    expect(canTransition('todo', 'done', true)).toBe(true)
    expect(canTransition('done', 'in_progress', true)).toBe(true)
  })

  it('sets started_at when moving to in progress', () => {
    const fields = statusUpdateFields('todo', 'in_progress', 'user-1')
    expect(fields.started_at).toBeTruthy()
    expect(fields.completed_at).toBeUndefined()
  })

  it('sets completed fields when marking done', () => {
    const fields = statusUpdateFields('in_progress', 'done', 'user-1')
    expect(fields.completed_at).toBeTruthy()
    expect(fields.completed_by).toBe('user-1')
  })

  it('clears completed fields when reopening', () => {
    const fields = statusUpdateFields('done', 'in_progress', 'user-1')
    expect(fields.completed_at).toBeNull()
    expect(fields.completed_by).toBeNull()
  })

  it('detects overdue open tasks', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const due = yesterday.toISOString().split('T')[0]
    expect(isTaskOverdue(due, 'todo')).toBe(true)
    expect(isTaskOverdue(due, 'done')).toBe(false)
    expect(isTaskOverdue(null, 'todo')).toBe(false)
  })

  it('defines staff transition map', () => {
    expect(STAFF_TRANSITIONS.todo).toEqual(['in_progress'])
    expect(STAFF_TRANSITIONS.in_progress).toEqual(['done'])
  })
})

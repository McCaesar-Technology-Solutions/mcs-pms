import { describe, expect, it } from 'vitest'
import {
  extensionAlreadyApplied,
  validateExtensionCompletion,
  validateHousekeepingCompletion,
} from '@/lib/guest/request-fulfillment'

describe('extension request fulfillment', () => {
  it('detects when reservation check-out already covers the requested date', () => {
    expect(extensionAlreadyApplied('2026-06-20', '2026-06-20')).toBe(true)
    expect(extensionAlreadyApplied('2026-06-20', '2026-06-22')).toBe(true)
    expect(extensionAlreadyApplied('2026-06-20', '2026-06-19')).toBe(false)
  })

  it('requires an active reservation with an extended check-out before completion', () => {
    const missing = validateExtensionCompletion('2026-06-20', null, null)
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error).toContain('No active reservation')
    }

    const notExtended = validateExtensionCompletion('2026-06-20', null, {
      check_out: '2026-06-17',
    })
    expect(notExtended.ok).toBe(false)
    if (!notExtended.ok) {
      expect(notExtended.error).toContain('Extend the stay')
    }

    const ready = validateExtensionCompletion('2026-06-20', null, {
      check_out: '2026-06-20',
    })
    expect(ready.ok).toBe(true)
    if (ready.ok) {
      expect(ready.checkOut).toBe('2026-06-20')
    }
  })
})

describe('housekeeping request fulfillment', () => {
  it('requires a linked task before completion', () => {
    const missing = validateHousekeepingCompletion('room-1', null)
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error).toContain('Schedule housekeeping')
    }

    const inProgress = validateHousekeepingCompletion('room-1', { id: 'task-1', status: 'in_progress' })
    expect(inProgress.ok).toBe(false)
    if (!inProgress.ok) {
      expect(inProgress.error).toContain('Mark the housekeeping task complete')
    }

    const ready = validateHousekeepingCompletion('room-1', { id: 'task-1', status: 'done' })
    expect(ready.ok).toBe(true)
    if (ready.ok) {
      expect(ready.taskId).toBe('task-1')
    }
  })
})

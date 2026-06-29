import { describe, expect, it } from 'vitest'
import { canEditOwnMessage, recipientHasNotReadMessage } from '@/lib/messaging/can-edit-message'

describe('recipientHasNotReadMessage', () => {
  it('returns true when recipient never read', () => {
    expect(recipientHasNotReadMessage('2026-06-15T10:00:00Z', null)).toBe(true)
  })

  it('returns true when read timestamp is before message', () => {
    expect(
      recipientHasNotReadMessage('2026-06-15T10:00:00Z', '2026-06-15T09:59:00Z'),
    ).toBe(true)
  })

  it('returns false when read at or after message', () => {
    expect(
      recipientHasNotReadMessage('2026-06-15T10:00:00Z', '2026-06-15T10:00:00Z'),
    ).toBe(false)
    expect(
      recipientHasNotReadMessage('2026-06-15T10:00:00Z', '2026-06-15T10:01:00Z'),
    ).toBe(false)
  })
})

describe('canEditOwnMessage', () => {
  it('requires all recipients to be unread', () => {
    expect(
      canEditOwnMessage('2026-06-15T10:00:00Z', [null, '2026-06-15T09:00:00Z']),
    ).toBe(true)
    expect(
      canEditOwnMessage('2026-06-15T10:00:00Z', [null, '2026-06-15T10:05:00Z']),
    ).toBe(false)
  })
})

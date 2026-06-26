import { describe, expect, it } from 'vitest'

/** Mirrors unread logic in loadGuestConversations. */
function isConversationUnread(
  lastAuthorRole: 'guest' | 'staff' | null,
  lastMessageAt: string | null,
  staffLastReadAt: string | null,
): boolean {
  return (
    lastAuthorRole === 'guest' &&
    Boolean(lastMessageAt) &&
    (!staffLastReadAt || lastMessageAt! > staffLastReadAt)
  )
}

describe('guest stay chat unread', () => {
  it('marks unread when guest sent after staff read', () => {
    expect(
      isConversationUnread('guest', '2026-06-26T12:00:00Z', '2026-06-26T11:00:00Z'),
    ).toBe(true)
  })

  it('marks read when staff replied last', () => {
    expect(isConversationUnread('staff', '2026-06-26T12:00:00Z', null)).toBe(false)
  })

  it('marks read when staff read after guest message', () => {
    expect(
      isConversationUnread('guest', '2026-06-26T11:00:00Z', '2026-06-26T12:00:00Z'),
    ).toBe(false)
  })

  it('marks unread when never read', () => {
    expect(isConversationUnread('guest', '2026-06-26T12:00:00Z', null)).toBe(true)
  })
})

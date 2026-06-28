'use client'

import { useMemo, useState } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { StaffGuestStayThread } from '@/components/guest-messages/staff-guest-stay-thread'
import { formatConversationTime } from '@/components/guest-messages/messaging-format'
import type { GuestConversationListItem } from '@/lib/data/guest-conversations'

interface GuestMessagesInboxProps {
  conversations: GuestConversationListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onBack?: () => void
}

function guestAvatarLabel(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'G'
}

export function GuestMessagesInbox({
  conversations,
  selectedId,
  onSelect,
  onBack,
}: GuestMessagesInboxProps) {
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const haystack = [c.guestName, c.roomNumber ?? '', c.lastMessageBody ?? '']
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [conversations, query])

  const unreadCount = conversations.filter((c) => c.unread).length
  const threadOpen = Boolean(selected)

  return (
    <div
      className={`staff-messenger ${threadOpen ? 'staff-messenger--thread-open' : ''}`}
    >
      <aside className="staff-messenger__sidebar" aria-label="Conversations">
        <div className="staff-messenger__sidebar-top">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Messages</h2>
            {unreadCount > 0 && (
              <span className="staff-messenger__unread-pill">{unreadCount} new</span>
            )}
          </div>
          <div className="staff-messenger__search">
            <Search className="staff-messenger__search-icon" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search guests or messages"
              className="staff-messenger__search-input"
              aria-label="Search conversations"
            />
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="staff-messenger__empty-sidebar">
            <MessageCircle className="h-9 w-9 text-[var(--brand-purple)]/25" />
            <p className="mt-3 text-sm font-semibold text-foreground">No conversations yet</p>
            <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
              When guests message the team from their portal, threads appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="staff-messenger__empty-sidebar">
            <p className="text-sm font-medium text-foreground">No matches</p>
            <p className="mt-1 text-xs text-muted-foreground">Try another name or room number.</p>
          </div>
        ) : (
          <ul className="staff-messenger__list">
            {filtered.map((c) => {
              const active = c.id === selectedId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`staff-messenger__row ${active ? 'staff-messenger__row--active' : ''} ${
                      c.unread ? 'staff-messenger__row--unread' : ''
                    }`}
                  >
                    <div className="staff-messenger__avatar" aria-hidden>
                      {guestAvatarLabel(c.guestName)}
                    </div>
                    <div className="staff-messenger__row-body">
                      <div className="staff-messenger__row-top">
                        <p className="staff-messenger__row-name">{c.guestName}</p>
                        <span className="staff-messenger__row-time">
                          {formatConversationTime(c.lastMessageAt)}
                        </span>
                      </div>
                      <div className="staff-messenger__row-bottom">
                        <p className="staff-messenger__row-preview">
                          {c.lastMessageBody ? (
                            <>
                              {c.lastAuthorRole === 'staff' && (
                                <span className="text-muted-foreground">You: </span>
                              )}
                              {c.lastMessageBody}
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">No messages yet</span>
                          )}
                        </p>
                        {c.unread && <span className="staff-messenger__dot" aria-label="Unread" />}
                      </div>
                      {c.roomNumber && (
                        <p className="staff-messenger__row-meta">Room {c.roomNumber}</p>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <main className="staff-messenger__main">
        {selected ? (
          <StaffGuestStayThread
            conversationId={selected.id}
            guestName={selected.guestName}
            roomNumber={selected.roomNumber}
            onBack={onBack}
          />
        ) : (
          <div className="staff-messenger__placeholder">
            <div className="staff-messenger__placeholder-icon">
              <MessageCircle className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold text-foreground">Your messages</p>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Select a guest on the left to reply, or wait for a new message from the portal.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

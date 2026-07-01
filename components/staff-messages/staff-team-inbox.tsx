'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Plus, Search, Users } from 'lucide-react'
import { StaffTeamThread } from '@/components/staff-messages/staff-team-thread'
import { NewStaffConversationModal } from '@/components/staff-messages/new-staff-conversation-modal'
import { formatConversationTime } from '@/components/guest-messages/messaging-format'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'
import type { StaffConversationListItem } from '@/lib/data/staff-conversations'

interface StaffTeamInboxProps {
  conversations: StaffConversationListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onBack?: () => void
  hotelStaff: { id: string; name: string; role: string }[]
  currentUserId: string
  onConversationCreated: (id: string) => void
  canManageGroupMembers?: boolean
}

export function StaffTeamInbox({
  conversations,
  selectedId,
  onSelect,
  onBack,
  hotelStaff,
  currentUserId,
  onConversationCreated,
  canManageGroupMembers = false,
}: StaffTeamInboxProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [, startTransition] = useTransition()

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const haystack = [c.name, ...c.memberNames, c.lastMessageBody ?? ''].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [conversations, query])

  const unreadCount = conversations.filter((c) => c.unread).length
  const threadOpen = Boolean(selected)

  return (
    <>
      <div
        className={`staff-messenger ${threadOpen ? 'staff-messenger--thread-open' : ''}`}
      >
        <aside className="staff-messenger__sidebar" aria-label="Team conversations">
          <div className="staff-messenger__sidebar-top">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base font-semibold tracking-tight text-foreground">Team chat</h1>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Direct messages and group threads
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {unreadCount > 0 && (
                  <span className="staff-messenger__unread-pill">{unreadCount} new</span>
                )}
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="staff-messenger__icon-btn"
                  aria-label="New conversation"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="staff-messenger__search">
              <Search className="staff-messenger__search-icon" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search team or messages"
                className="staff-messenger__search-input"
                aria-label="Search team conversations"
              />
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="staff-messenger__empty-sidebar">
              <Users className="h-9 w-9 text-[var(--brand-purple)]/25" />
              <p className="mt-3 text-sm font-semibold text-foreground">No team chats yet</p>
              <p className="mt-1 max-w-[220px] text-xs leading-relaxed text-muted-foreground">
                Start a direct message or create a group for shift coordination.
              </p>
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="app-btn app-btn-primary mt-4 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New conversation
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="staff-messenger__empty-sidebar">
              <p className="text-sm font-medium text-foreground">No matches</p>
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
                      <MessengerAvatar
                        name={c.name}
                        imageUrl={c.avatarUrl}
                        variant={c.conversationType === 'group' ? 'group' : 'person'}
                      />
                      <div className="staff-messenger__row-body">
                        <div className="staff-messenger__row-top">
                          <p className="staff-messenger__row-name">{c.name}</p>
                          <span className="staff-messenger__row-time">
                            {formatConversationTime(c.lastMessageAt)}
                          </span>
                        </div>
                        <div className="staff-messenger__row-bottom">
                          <p className="staff-messenger__row-preview">
                            {c.lastMessageBody ? (
                              <>
                                {c.lastAuthorName && (
                                  <span className="text-muted-foreground">{c.lastAuthorName}: </span>
                                )}
                                {c.lastMessageBody}
                              </>
                            ) : (
                              <span className="text-muted-foreground italic">No messages yet</span>
                            )}
                          </p>
                          {c.unread && <span className="staff-messenger__dot" aria-label="Unread" />}
                        </div>
                        {c.conversationType === 'group' && (
                          <p className="staff-messenger__row-meta">{c.memberNames.length} members</p>
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
            <StaffTeamThread
              conversationId={selected.id}
              title={selected.name}
              avatarUrl={selected.avatarUrl}
              conversationType={selected.conversationType}
              subtitle={
                selected.conversationType === 'group'
                  ? `${selected.memberNames.length} members`
                  : 'Direct message'
              }
              onBack={onBack}
              canManageGroupMembers={canManageGroupMembers}
              hotelStaff={hotelStaff}
              onMembersChanged={() => router.refresh()}
            />
          ) : (
            <div className="staff-messenger__placeholder">
              <div className="staff-messenger__placeholder-icon">
                <MessageCircle className="h-8 w-8" />
              </div>
              <p className="text-base font-semibold text-foreground">Team messages</p>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Select a thread or start a new chat with a colleague.
              </p>
            </div>
          )}
        </main>
      </div>

      {composeOpen && (
        <NewStaffConversationModal
          hotelStaff={hotelStaff.filter((s) => s.id !== currentUserId)}
          onClose={() => setComposeOpen(false)}
          onCreated={(id) => {
            setComposeOpen(false)
            startTransition(() => onConversationCreated(id))
          }}
        />
      )}
    </>
  )
}

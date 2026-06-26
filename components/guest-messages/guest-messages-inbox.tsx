'use client'

import { useMemo } from 'react'
import { MessageCircle } from 'lucide-react'
import { StaffGuestStayThread } from '@/components/guest-messages/staff-guest-stay-thread'
import type { GuestConversationListItem } from '@/lib/data/guest-conversations'

interface GuestMessagesInboxProps {
  conversations: GuestConversationListItem[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function formatRelative(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function GuestMessagesInbox({
  conversations,
  selectedId,
  onSelect,
}: GuestMessagesInboxProps) {
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">In-house guests</p>
          <p className="text-xs text-muted-foreground">Stay chat — general questions & updates</p>
        </div>
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground">
              When guests message the team from their portal, threads appear here.
            </p>
          </div>
        ) : (
          <ul className="max-h-[520px] divide-y divide-border/60 overflow-y-auto">
            {conversations.map((c) => {
              const active = c.id === selectedId
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40 ${
                      active ? 'bg-[#3C216C]/5' : ''
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3C216C]/10 text-xs font-bold text-[#3C216C]">
                      {c.guestName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {c.guestName}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatRelative(c.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.roomNumber ? `Room ${c.roomNumber}` : 'No room'}
                      </p>
                      {c.lastMessageBody && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {c.lastAuthorRole === 'staff' ? 'You: ' : ''}
                          {c.lastMessageBody}
                        </p>
                      )}
                    </div>
                    {c.unread && (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#D85A30]" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="min-h-[420px]">
        {selected ? (
          <StaffGuestStayThread
            conversationId={selected.id}
            guestName={selected.guestName}
            roomNumber={selected.roomNumber}
          />
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-[#3C216C]/30" />
            <p className="text-sm font-semibold text-foreground">Select a guest</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Choose a conversation to reply, or wait for a guest to message the team from their
              portal.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

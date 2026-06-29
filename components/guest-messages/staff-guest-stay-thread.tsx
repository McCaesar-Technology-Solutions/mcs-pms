'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, RefreshCw, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getStaffGuestStayMessages,
  postStaffGuestStayMessage,
  editStaffGuestStayMessage,
} from '@/app/actions/guest-conversation'
import { prepopulateMessageComposer } from '@/lib/messaging/prepopulate-composer'
import {
  formatMessageTime,
  groupMessagesByDay,
} from '@/components/guest-messages/messaging-format'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'
import { EditableMessageContent } from '@/components/messaging/editable-message-content'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'

interface ChatMessage {
  id: string
  authorRole: string
  body: string
  createdAt: string
  authorName: string | null
  authorAvatarUrl: string | null
  editedAt?: string | null
  canEdit?: boolean
}

interface StaffGuestStayThreadProps {
  conversationId: string
  guestName?: string | null
  guestAvatarUrl?: string | null
  roomNumber?: string | null
  guestDoNotDisturb?: boolean
  onBack?: () => void
}

const STAFF_QUICK_REPLIES = [
  'Thanks — we will help shortly.',
  'What time works for a room visit?',
  'Checkout is at 11:00 AM tomorrow.',
  'Anything else we can help with?',
] as const

export function StaffGuestStayThread({
  conversationId,
  guestName,
  guestAvatarUrl,
  roomNumber,
  guestDoNotDisturb,
  onBack,
}: StaffGuestStayThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true)
      const result = await getStaffGuestStayMessages(conversationId)
      if (result.success && result.data) {
        setMessages(result.data)
      }
      setInitialLoading(false)
      setRefreshing(false)
    },
    [conversationId],
  )

  useEffect(() => {
    setInitialLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (!initialLoading) scrollToBottom(initialLoading ? 'auto' : 'smooth')
  }, [messages, initialLoading, scrollToBottom])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`staff-stay-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guest_conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void load({ silent: true })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'guest_conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void load({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, load])

  const messageGroups = useMemo(() => groupMessagesByDay(messages), [messages])

  async function handleSend(text?: string) {
    const trimmed = (text ?? body).trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)

    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      authorRole: 'staff',
      body: trimmed,
      createdAt: new Date().toISOString(),
      authorName: 'You',
      authorAvatarUrl: null,
    }
    setMessages((prev) => [...prev, optimistic])
    if (!text) setBody('')
    requestAnimationFrame(() => scrollToBottom())

    const result = await postStaffGuestStayMessage({ conversationId, body: trimmed })
    setLoading(false)

    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setError(result.error ?? 'Could not send message.')
      if (!text) setBody(trimmed)
      return
    }

    await load({ silent: true })
    textareaRef.current?.focus()
  }

  async function handleEditMessage(messageId: string, nextBody: string) {
    const result = await editStaffGuestStayMessage({ messageId, body: nextBody })
    if (result.success) await load({ silent: true })
    return { success: result.success, error: result.success ? undefined : result.error }
  }

  return (
    <div className="staff-messenger__thread">
      <header className="staff-messenger__thread-header">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="staff-messenger__back lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <MessengerAvatar
          name={guestName ?? 'Guest'}
          imageUrl={guestAvatarUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground inline-flex items-center gap-2">
            {guestName ?? 'Guest'}
            {guestDoNotDisturb && <GuestDndBadge compact />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {roomNumber ? `Room ${roomNumber}` : 'No room assigned'}
            <span className="mx-1.5 text-border">·</span>
            Stay chat
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="staff-messenger__icon-btn"
          aria-label="Refresh messages"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div ref={scrollRef} className="staff-messenger__messages" aria-live="polite">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-purple)]" />
            <p className="text-sm">Loading conversation…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium text-foreground">Start the conversation</p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Say hello or pick a quick reply below. Messages appear here in real time.
            </p>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.label} className="staff-messenger__day-group">
              <p className="staff-messenger__day-label">{group.label}</p>
              <div className="space-y-1">
                {group.messages.map((m, index) => {
                  const isStaff = m.authorRole === 'staff'
                  const prev = group.messages[index - 1]
                  const next = group.messages[index + 1]
                  const sameAsPrev = prev?.authorRole === m.authorRole
                  const sameAsNext = next?.authorRole === m.authorRole
                  const position = sameAsPrev && sameAsNext
                    ? 'middle'
                    : sameAsPrev
                      ? 'end'
                      : sameAsNext
                        ? 'start'
                        : 'single'

                  return (
                    <div
                      key={m.id}
                      className={`staff-messenger__bubble-row ${
                        isStaff ? 'staff-messenger__bubble-row--out' : 'staff-messenger__bubble-row--in'
                      }`}
                    >
                      {!isStaff && (
                        <MessengerAvatar
                          name={guestName ?? 'Guest'}
                          imageUrl={m.authorAvatarUrl ?? guestAvatarUrl}
                          size="xs"
                        />
                      )}
                      <div
                        className={`staff-messenger__bubble staff-messenger__bubble--${position} ${
                          isStaff
                            ? 'staff-messenger__bubble--staff'
                            : 'staff-messenger__bubble--guest'
                        }`}
                      >
                        <EditableMessageContent
                          messageId={m.id}
                          body={m.body}
                          editedAt={messages.find((row) => row.id === m.id)?.editedAt}
                          canEdit={messages.find((row) => row.id === m.id)?.canEdit}
                          onSave={handleEditMessage}
                          bodyClassName="whitespace-pre-wrap break-words"
                        />
                        <span className="staff-messenger__bubble-time">
                          {formatMessageTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="staff-messenger__composer">
        <div className="staff-messenger__quick-replies">
          {STAFF_QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => prepopulateMessageComposer(q, setBody, textareaRef)}
              disabled={loading}
              className="staff-messenger__quick-reply"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleSend()
          }}
          className="staff-messenger__compose-form"
        >
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            rows={1}
            placeholder="Message…"
            className="staff-messenger__compose-input"
            aria-label="Message guest"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="staff-messenger__send"
            aria-label="Send message"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </footer>
    </div>
  )
}

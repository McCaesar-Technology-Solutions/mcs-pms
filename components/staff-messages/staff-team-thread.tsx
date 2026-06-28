'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, Loader2, RefreshCw, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getStaffTeamMessages, postStaffTeamMessage } from '@/app/actions/staff-conversation'
import { prepopulateMessageComposer } from '@/lib/messaging/prepopulate-composer'
import {
  formatMessageTime,
  groupMessagesByDay,
} from '@/components/guest-messages/messaging-format'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'
import { StaffTeamConversationDetails } from '@/components/staff-messages/staff-team-conversation-details'
import type { StaffConversationMessage } from '@/lib/data/staff-conversations'

interface StaffTeamThreadProps {
  conversationId: string
  title: string
  avatarUrl?: string | null
  conversationType?: 'dm' | 'group'
  subtitle?: string | null
  onBack?: () => void
}

const TEAM_QUICK_REPLIES = [
  'On my way.',
  'Can you cover the desk for 10 minutes?',
  'Room is ready for inspection.',
  'Guest issue handled.',
] as const

export function StaffTeamThread({
  conversationId,
  title,
  avatarUrl,
  conversationType = 'dm',
  subtitle,
  onBack,
}: StaffTeamThreadProps) {
  const [messages, setMessages] = useState<StaffConversationMessage[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
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
      const result = await getStaffTeamMessages(conversationId)
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
    setDetailsOpen(false)
  }, [conversationId])

  useEffect(() => {
    if (!initialLoading) scrollToBottom(initialLoading ? 'auto' : 'smooth')
  }, [messages, initialLoading, scrollToBottom])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`staff-team-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'staff_conversation_messages',
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

  const messageGroups = useMemo(() => {
    const adapted = messages.map((m) => ({
      id: m.id,
      authorRole: m.isOwn ? 'staff' : 'guest',
      body: m.body,
      createdAt: m.createdAt,
      authorName: m.authorName,
      isOwn: m.isOwn,
    }))
    return groupMessagesByDay(adapted).map((group) => ({
      ...group,
      messages: group.messages.map((msg) => {
        const source = adapted.find((m) => m.id === msg.id)
        return { ...msg, isOwn: source?.isOwn ?? false }
      }),
    }))
  }, [messages])

  async function handleSend() {
    const trimmed = body.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)
    setBody('')

    const result = await postStaffTeamMessage({ conversationId, body: trimmed })
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not send message.')
      setBody(trimmed)
      return
    }

    await load({ silent: true })
    textareaRef.current?.focus()
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
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="staff-messenger__thread-profile-btn"
          aria-label={
            conversationType === 'group'
              ? 'View group details and members'
              : 'View conversation details'
          }
        >
          <MessengerAvatar
            name={title}
            imageUrl={avatarUrl}
            size="lg"
            variant={conversationType === 'group' ? 'group' : 'person'}
          />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate font-semibold text-foreground">{title}</p>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
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

      <StaffTeamConversationDetails
        conversationId={conversationId}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
      />

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
              Pick a quick reply below or type your own message.
            </p>
          </div>
        ) : (
          messageGroups.map((group) => (
            <div key={group.label} className="staff-messenger__day-group">
              <p className="staff-messenger__day-label">{group.label}</p>
              {group.messages.map((msg, idx) => {
                const isOut = 'isOwn' in msg && Boolean((msg as { isOwn?: boolean }).isOwn)
                const prev = group.messages[idx - 1]
                const next = group.messages[idx + 1]
                const sameAuthor = prev?.authorRole === msg.authorRole
                const nextSame = next?.authorRole === msg.authorRole
                let corner = 'single'
                if (sameAuthor && nextSame) corner = 'middle'
                else if (sameAuthor) corner = 'end'
                else if (nextSame) corner = 'start'

                return (
                  <div
                    key={msg.id}
                    className={`staff-messenger__bubble-row ${isOut ? 'staff-messenger__bubble-row--out' : 'staff-messenger__bubble-row--in'}`}
                  >
                    {!isOut && (
                      <MessengerAvatar
                        name={msg.authorName ?? 'Staff'}
                        imageUrl={
                          messages.find((m) => m.id === msg.id)?.authorAvatarUrl ?? null
                        }
                        size="xs"
                      />
                    )}
                    <div
                      className={`staff-messenger__bubble ${isOut ? 'staff-messenger__bubble--staff' : 'staff-messenger__bubble--guest'} staff-messenger__bubble--${corner}`}
                    >
                      {!isOut && msg.authorName && (
                        <p className="mb-0.5 text-[10px] font-semibold text-[var(--brand-purple)]">
                          {msg.authorName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-sm">{msg.body}</p>
                      <time className="staff-messenger__bubble-time" dateTime={msg.createdAt}>
                        {formatMessageTime(msg.createdAt)}
                      </time>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      <div className="staff-messenger__composer">
        <div className="staff-messenger__quick-replies">
          {TEAM_QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => prepopulateMessageComposer(q, setBody, textareaRef)}
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
            placeholder="Message your team…"
            aria-label="Team message"
            className="staff-messenger__compose-input"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="staff-messenger__send"
            aria-label="Send message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

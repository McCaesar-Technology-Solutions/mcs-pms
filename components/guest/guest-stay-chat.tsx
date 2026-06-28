'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getGuestStayMessages, postGuestStayMessage } from '@/app/actions/guest-conversation'
import { prepopulateMessageComposer } from '@/lib/messaging/prepopulate-composer'
import { FormError } from '@/components/ui/form-error'
import { MessengerAvatar } from '@/components/messaging/messenger-avatar'

const GUEST_QUICK_REPLIES = [
  'What time is checkout?',
  'Can we get extra towels?',
  'We will arrive late tonight.',
  'Thank you!',
] as const

interface GuestStayChatProps {
  variant?: 'embedded' | 'screen'
  propertyName?: string
}

export function GuestStayChat({ variant = 'embedded', propertyName }: GuestStayChatProps) {
  const isScreen = variant === 'screen'
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<
    {
      id: string
      authorRole: string
      body: string
      createdAt: string
      authorName: string | null
      authorAvatarUrl: string | null
    }[]
  >([])
  const [guestAvatarUrl, setGuestAvatarUrl] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const staffMessageCountRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true)
    const result = await getGuestStayMessages()
    if (result.success && result.data) {
      const next = result.data.messages
      const staffCount = next.filter((m) => m.authorRole === 'staff').length
      if (
        opts?.silent &&
        staffCount > staffMessageCountRef.current &&
        staffMessageCountRef.current > 0
      ) {
        toast.info('New message from the team')
      }
      staffMessageCountRef.current = staffCount
      setConversationId(result.data.conversationId)
      setGuestAvatarUrl(result.data.guestAvatarUrl)
      setMessages(next)
    }
    setInitialLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    setInitialLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (!initialLoading) scrollToBottom()
  }, [messages, initialLoading, scrollToBottom])

  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 15000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    if (!conversationId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`guest-stay-chat-${conversationId}`)
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, load])

  async function handleSend(text?: string) {
    const trimmed = (text ?? body).trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)

    const optimistic = {
      id: `pending-${Date.now()}`,
      authorRole: 'guest',
      body: trimmed,
      createdAt: new Date().toISOString(),
      authorName: 'You',
      authorAvatarUrl: guestAvatarUrl,
    }
    setMessages((prev) => [...prev, optimistic])
    if (!text) setBody('')
    requestAnimationFrame(() => scrollToBottom())

    const result = await postGuestStayMessage({ body: trimmed })
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

  return (
    <div
      className={
        isScreen ? 'guest-stay-chat guest-stay-chat--screen' : 'guest-subpanel'
      }
    >
      <div className={isScreen ? 'guest-stay-chat__header' : 'guest-subpanel__header'}>
        <div>
          <p className="text-sm font-semibold">Message the team</p>
          <p className="text-xs guest-text-subtle">
            {isScreen && propertyName
              ? `Chat with ${propertyName} — replies usually within a few minutes`
              : 'Chat with the front desk about your stay'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="guest-icon-btn"
          aria-label="Refresh messages"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className={
          isScreen
            ? 'guest-stay-chat__messages'
            : 'max-h-72 space-y-3 overflow-y-auto px-4 py-4'
        }
        aria-live="polite"
      >
        {initialLoading ? (
          <div
            className={`flex items-center justify-center guest-text-subtle ${
              isScreen ? 'flex-1 py-16' : 'py-8'
            }`}
          >
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div
            className={`text-center ${isScreen ? 'flex flex-1 flex-col items-center justify-center px-6 py-16' : 'py-6'}`}
          >
            <p className={`font-medium text-foreground ${isScreen ? 'text-base' : 'text-sm'}`}>
              {isScreen ? 'Say hello to the front desk' : 'Start a conversation'}
            </p>
            <p className="mt-2 text-sm leading-relaxed guest-text-muted">
              Ask about checkout, arrivals, or anything else — the team will reply here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => {
              const isGuest = m.authorRole === 'guest'
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${isGuest ? 'justify-end' : 'justify-start'}`}
                >
                  {!isGuest && (
                    <MessengerAvatar
                      name={m.authorName ?? 'Front desk'}
                      imageUrl={m.authorAvatarUrl}
                      size="xs"
                    />
                  )}
                  <div
                    className={`guest-bubble ${
                      isGuest ? 'guest-bubble--guest' : 'guest-bubble--staff'
                    }`}
                  >
                    {!isGuest && (
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-purple)]">
                        {m.authorName ?? 'Front desk'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  {isGuest && (
                    <MessengerAvatar
                      name="You"
                      imageUrl={m.authorAvatarUrl ?? guestAvatarUrl}
                      size="xs"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={isScreen ? 'guest-stay-chat__composer' : 'guest-divider px-3 py-3'}>
        <div
          className={
            isScreen
              ? 'guest-stay-chat__quick-replies'
              : 'mb-2 flex flex-wrap gap-1.5'
          }
        >
          {GUEST_QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => prepopulateMessageComposer(q, setBody, textareaRef)}
              disabled={loading}
              className={
                isScreen
                  ? 'guest-stay-chat__quick-reply'
                  : 'rounded-full border border-[var(--guest-border)] bg-[var(--guest-accent-softer)] px-2.5 py-1 text-[11px] guest-text-muted hover:bg-[var(--guest-accent-soft)]'
              }
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
          className={isScreen ? 'guest-stay-chat__compose-form' : 'flex items-end gap-2'}
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
            rows={isScreen ? 1 : 2}
            placeholder="Type a message…"
            className={
              isScreen
                ? 'guest-stay-chat__compose-input'
                : 'guest-field min-h-[44px] flex-1 resize-none'
            }
            aria-label="Message to front desk"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className={
              isScreen
                ? 'guest-stay-chat__send'
                : 'guest-btn guest-btn-primary flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-40'
            }
            aria-label="Send message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <FormError message={error} className="mt-2" />
      </div>
    </div>
  )
}

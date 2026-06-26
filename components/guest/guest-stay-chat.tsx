'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getGuestStayMessages, postGuestStayMessage } from '@/app/actions/guest-conversation'
import { FormError } from '@/components/ui/form-error'

const GUEST_QUICK_REPLIES = [
  'What time is checkout?',
  'Can we get extra towels?',
  'We will arrive late tonight.',
  'Thank you!',
] as const

export function GuestStayChat() {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<
    { id: string; authorRole: string; body: string; createdAt: string }[]
  >([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const staffMessageCountRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

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
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Message the team</p>
          <p className="text-xs text-white/55">Chat with the front desk about your stay</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="rounded-lg p-2 text-white/60 hover:bg-white/10"
          aria-label="Refresh messages"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-72 space-y-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {initialLoading ? (
          <div className="flex items-center justify-center py-8 text-white/50">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/55">
            Ask about checkout, requests, or anything else — the front desk will reply here.
          </p>
        ) : (
          messages.map((m) => {
            const isGuest = m.authorRole === 'guest'
            return (
              <div
                key={m.id}
                className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isGuest
                      ? 'rounded-br-md bg-[#D4A62E] text-[#22124C]'
                      : 'rounded-bl-md bg-white/10 text-white'
                  }`}
                >
                  {!isGuest && (
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#D4A62E]">
                      Front desk
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {GUEST_QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void handleSend(q)}
              disabled={loading}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/75 hover:bg-white/15"
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
          className="flex items-end gap-2"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            rows={2}
            placeholder="Type a message…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#D4A62E]/50"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4A62E] text-[#22124C] disabled:opacity-40"
            aria-label="Send message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <FormError message={error} variant="dark" className="mt-2" />
      </div>
    </div>
  )
}

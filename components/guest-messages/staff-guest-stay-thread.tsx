'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, RefreshCw, Send, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getStaffGuestStayMessages,
  postStaffGuestStayMessage,
} from '@/app/actions/guest-conversation'

interface ChatMessage {
  id: string
  authorRole: string
  body: string
  createdAt: string
  authorName: string | null
}

interface StaffGuestStayThreadProps {
  conversationId: string
  guestName?: string | null
  roomNumber?: string | null
}

const STAFF_QUICK_REPLIES = [
  'Thanks for your message — we will help shortly.',
  'What time works best for us to visit your room?',
  'Your checkout is at 11:00 AM tomorrow.',
  'Is there anything else we can help with?',
] as const

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function StaffGuestStayThread({
  conversationId,
  guestName,
  roomNumber,
}: StaffGuestStayThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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
    if (!initialLoading) scrollToBottom()
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

    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      authorRole: 'staff',
      body: trimmed,
      createdAt: new Date().toISOString(),
      authorName: 'You',
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
  }

  const guestInitial = (guestName ?? 'G').charAt(0).toUpperCase()

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[#3C216C]/10 bg-white shadow-elevation-1">
      <div className="border-b border-border/60 bg-gradient-to-r from-[#3C216C]/5 to-transparent px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3C216C]/10 text-sm font-bold text-[#3C216C]">
            {guestInitial}
          </div>
          <div>
            <p className="font-semibold text-foreground">{guestName ?? 'Guest'}</p>
            <p className="text-xs text-muted-foreground">
              {roomNumber ? `Room ${roomNumber}` : 'No room assigned'} · Stay chat
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={refreshing}
            className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {initialLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 text-[#3C216C]/40" />
            <p className="text-sm">No messages yet. Say hello or ask the guest a question.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isStaff = m.authorRole === 'staff'
            return (
              <div key={m.id} className={`flex gap-2 ${isStaff ? 'flex-row-reverse' : ''}`}>
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isStaff ? 'bg-[#3C216C] text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isStaff ? <User className="h-3.5 w-3.5" /> : guestInitial}
                </div>
                <div className={`max-w-[78%] ${isStaff ? 'text-right' : ''}`}>
                  <p className="mb-0.5 text-[10px] text-muted-foreground">
                    {isStaff ? m.authorName ?? 'Staff' : guestName ?? 'Guest'} ·{' '}
                    {formatMessageTime(m.createdAt)}
                  </p>
                  <div
                    className={`inline-block rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      isStaff
                        ? 'rounded-tr-md bg-[#3C216C] text-white'
                        : 'rounded-tl-md bg-muted text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-left">{m.body}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-border/60 bg-muted/20 px-3 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {STAFF_QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void handleSend(q)}
              disabled={loading}
              className="rounded-full border border-border/60 bg-white px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[#3C216C]/30 hover:text-foreground"
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
            placeholder="Message guest…"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border/60 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3C216C]/20"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3C216C] text-white disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

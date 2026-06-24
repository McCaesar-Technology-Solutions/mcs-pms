'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, MessageCircle, RefreshCw, Send, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getStaffComplaintMessages, postStaffComplaintMessage } from '@/app/actions/complaints'

interface ChatMessage {
  id: string
  authorRole: string
  body: string
  createdAt: string
  authorName: string | null
}

interface StaffComplaintMessageThreadProps {
  complaintId: string
  guestName?: string | null
  roomNumber?: string | null
  complaintCategory?: string | null
}

const QUICK_REPLIES = [
  "Thanks for reporting this — we're on it.",
  'A technician has been assigned and will contact you shortly.',
  'What time works best for a visit to your room?',
  'Is the issue still happening right now?',
  "We've completed the repair — please let us know if anything's still wrong.",
] as const

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function categoryLabel(value: string | null | undefined) {
  if (!value) return null
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function StaffComplaintMessageThread({
  complaintId,
  guestName,
  roomNumber,
  complaintCategory,
}: StaffComplaintMessageThreadProps) {
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
      const result = await getStaffComplaintMessages(complaintId)
      if (result.success && result.data) {
        setMessages(result.data)
      }
      setInitialLoading(false)
      setRefreshing(false)
    },
    [complaintId],
  )

  useEffect(() => {
    setInitialLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    if (!initialLoading) scrollToBottom(initialLoading ? 'auto' : 'smooth')
  }, [messages, initialLoading, scrollToBottom])

  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 5000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`staff-complaint-chat-${complaintId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'complaint_messages',
          filter: `complaint_id=eq.${complaintId}`,
        },
        () => {
          void load({ silent: true })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [complaintId, load])

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

    const result = await postStaffComplaintMessage({ complaintId, body: trimmed })
    setLoading(false)

    if (!result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setError(result.error ?? 'Could not send message.')
      if (!text) setBody(trimmed)
      return
    }

    await load({ silent: true })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleSend()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const guestInitial = (guestName ?? 'G').charAt(0).toUpperCase()

  return (
    <div className="overflow-hidden rounded-2xl border border-[#3C216C]/10 bg-gradient-to-b from-[#3C216C]/[0.04] to-white shadow-elevation-1">
      <div className="flex items-start justify-between gap-3 border-b border-[#3C216C]/10 bg-[#3C216C]/[0.06] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3C216C] text-sm font-bold text-white shadow-elevation-1">
            {guestInitial}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="truncate text-sm font-semibold text-foreground">
                {guestName ?? 'Guest'}
              </p>
              {roomNumber && (
                <span className="rounded-md bg-[#3C216C]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3C216C]">
                  Room {roomNumber}
                </span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              {categoryLabel(complaintCategory) ?? 'Complaint chat'}
              {messages.length > 0 && (
                <span className="text-muted-foreground/70">· {messages.length} messages</span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/80 hover:text-[#3C216C] disabled:opacity-50"
          aria-label="Refresh messages"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[min(360px,45vh)] min-h-[220px] space-y-3 overflow-y-auto px-4 py-4"
      >
        {initialLoading ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-[#3C216C]/50" />
            <p className="text-sm">Loading conversation…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3C216C]/8">
              <User className="h-6 w-6 text-[#3C216C]/60" />
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">No messages yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Send an update to {guestName ?? 'the guest'}. They&apos;ll see it instantly in their
              portal under Help → My issues.
            </p>
          </div>
        ) : (
          messages.map((m, index) => {
            const isStaff = m.authorRole === 'staff'
            const isPending = m.id.startsWith('pending-')
            const showDay =
              index === 0 ||
              dayLabel(m.createdAt) !== dayLabel(messages[index - 1]!.createdAt)

            return (
              <div key={m.id}>
                {showDay && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      isStaff
                        ? 'rounded-br-md bg-[#3C216C] text-white'
                        : 'rounded-bl-md border border-border/60 bg-white text-foreground'
                    } ${isPending ? 'opacity-70' : ''}`}
                  >
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide ${
                        isStaff ? 'text-white/65' : 'text-muted-foreground'
                      }`}
                    >
                      {isStaff ? (m.authorName ?? 'You') : (guestName ?? 'Guest')}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    <p
                      className={`mt-1.5 text-[10px] ${
                        isStaff ? 'text-white/45' : 'text-muted-foreground/80'
                      }`}
                    >
                      {isPending ? 'Sending…' : formatMessageTime(m.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-border/60 bg-[#FAFDFF]/80 px-3 py-3">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => void handleSend(reply)}
              disabled={loading}
              className="shrink-0 rounded-full border border-[#3C216C]/15 bg-white px-3 py-1.5 text-left text-[11px] leading-snug text-[#3C216C] shadow-sm transition hover:border-[#3C216C]/30 hover:bg-[#3C216C]/5 disabled:opacity-50"
            >
              {reply}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${guestName ?? 'guest'}…`}
            rows={2}
            className="min-h-[44px] max-h-28 min-w-0 flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2.5 text-sm leading-relaxed shadow-elevation-1 outline-none transition focus:border-[#3C216C]/30 focus:ring-2 focus:ring-[#3C216C]/10"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3C216C] text-white shadow-elevation-1 transition hover:bg-[#4c2a85] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

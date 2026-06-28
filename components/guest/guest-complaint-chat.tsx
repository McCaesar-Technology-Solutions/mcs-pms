'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getComplaintMessages, postGuestComplaintMessage } from '@/app/actions/guest-portal'
import { prepopulateMessageComposer } from '@/lib/messaging/prepopulate-composer'
import { FormError } from '@/components/ui/form-error'

interface GuestComplaintChatProps {
  complaintId: string
}

const GUEST_QUICK_REPLIES = [
  "I'm in the room if you need access.",
  'The issue is still happening.',
  'That fixed it — thank you!',
  'When will someone arrive?',
] as const

export function GuestComplaintChat({ complaintId }: GuestComplaintChatProps) {
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
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setRefreshing(true)
      const result = await getComplaintMessages(complaintId)
      if (result.success && result.data) {
        const next = result.data.messages
        const staffCount = next.filter((m) => m.authorRole === 'staff').length
        if (
          opts?.silent &&
          staffCount > staffMessageCountRef.current &&
          staffMessageCountRef.current > 0
        ) {
          toast.info('New message from staff')
        }
        staffMessageCountRef.current = staffCount
        setMessages(next)
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
    if (!initialLoading) scrollToBottom()
  }, [messages, initialLoading, scrollToBottom])

  useEffect(() => {
    const interval = setInterval(() => load({ silent: true }), 15000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`guest-complaint-chat-${complaintId}`)
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
    const result = await postGuestComplaintMessage({ complaintId, body: trimmed })
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not send message.')
      return
    }

    if (!text) setBody('')
    await load({ silent: true })
    scrollToBottom()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleSend()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="guest-btn guest-btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
          aria-label="Refresh messages"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 guest-text-subtle">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm guest-text-muted">
            No messages yet. Send a note to the team about this issue.
          </p>
        ) : (
          messages.map((m) => {
            const isGuest = m.authorRole === 'guest'
            return (
              <div key={m.id} className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`guest-bubble ${
                    isGuest ? 'guest-bubble--guest' : 'guest-bubble--staff'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">
                    {isGuest ? 'You' : 'Staff'}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-60">
                    {new Date(m.createdAt).toLocaleString('en-GB', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-4 shrink-0">
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {GUEST_QUICK_REPLIES.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => prepopulateMessageComposer(reply, setBody, inputRef)}
              disabled={loading}
              className="shrink-0 rounded-full border border-[var(--guest-border)] bg-[var(--guest-accent-softer)] px-3 py-1.5 text-left text-[11px] leading-snug guest-text-muted hover:bg-[var(--guest-accent-soft)] disabled:opacity-50"
            >
              {reply}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type a message…"
            aria-label="Message to staff"
            className="guest-field min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={loading || !body.trim()}
            aria-label="Send message"
            className="guest-btn guest-btn-primary flex h-12 w-12 shrink-0 items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </form>
        <FormError message={error} className="mt-2" />
      </div>
    </div>
  )
}

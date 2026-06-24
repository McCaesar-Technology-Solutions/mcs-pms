'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { getComplaintMessages, postGuestComplaintMessage } from '@/app/actions/guest-portal'

interface GuestComplaintChatProps {
  complaintId: string
}

export function GuestComplaintChat({ complaintId }: GuestComplaintChatProps) {
  const [messages, setMessages] = useState<
    { id: string; authorRole: string; body: string; createdAt: string }[]
  >([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await getComplaintMessages(complaintId)
    if (result.success && result.data) setMessages(result.data.messages)
  }, [complaintId])

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [load])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setLoading(true)
    setError(null)
    const result = await postGuestComplaintMessage({ complaintId, body: body.trim() })
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setBody('')
    await load()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-white/50">
            No messages yet. Send a note to the team about this issue.
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    isGuest
                      ? 'bg-[#3C216C] text-white'
                      : 'bg-white/10 text-white/90'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">
                    {isGuest ? 'You' : 'Staff'}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-45">
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

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
        />
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D4A62E] text-[#22124C] disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-200">{error}</p>}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { getStaffComplaintMessages, postStaffComplaintMessage } from '@/app/actions/complaints'

interface StaffComplaintMessageThreadProps {
  complaintId: string
}

export function StaffComplaintMessageThread({ complaintId }: StaffComplaintMessageThreadProps) {
  const [messages, setMessages] = useState<
    { id: string; authorRole: string; body: string; createdAt: string; authorName: string | null }[]
  >([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const result = await getStaffComplaintMessages(complaintId)
    if (result.success && result.data) setMessages(result.data)
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
    const result = await postStaffComplaintMessage({ complaintId, body: body.trim() })
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setBody('')
    await load()
  }

  return (
    <div className="rounded-2xl bg-white shadow-elevation-1">
      <div className="border-b border-border/60 px-4 py-3">
        <p className="text-sm font-semibold text-[#3C216C]">Guest conversation</p>
        <p className="text-xs text-muted-foreground">Replies appear in the guest portal.</p>
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isStaff = m.authorRole === 'staff'
            return (
              <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    isStaff ? 'bg-[#3C216C]/10 text-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    {isStaff ? (m.authorName ?? 'Staff') : 'Guest'}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2 border-t border-border/60 p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply to guest…"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !body.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3C216C] text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
      {error && <p className="px-4 pb-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}

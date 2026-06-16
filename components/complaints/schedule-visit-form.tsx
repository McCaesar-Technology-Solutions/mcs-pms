'use client'

import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { formatComplaintVisit } from '@/lib/complaints/visit'

interface ScheduleVisitFormProps {
  complaintId: string
  scheduledVisitAt: string | null
  onSchedule: (input: { complaintId: string; visitAt: string }) => Promise<{
    success: boolean
    error?: string
  }>
  onSuccess?: () => void
  variant?: 'dark' | 'light'
  disabled?: boolean
  title?: string
  hint?: string
  submitLabel?: string
}

export function ScheduleVisitForm({
  complaintId,
  scheduledVisitAt,
  onSchedule,
  onSuccess,
  variant = 'light',
  disabled = false,
  title = 'Scheduled visit',
  hint,
  submitLabel,
}: ScheduleVisitFormProps) {
  const [visitAt, setVisitAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDark = variant === 'dark'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!visitAt) return
    setLoading(true)
    setError(null)
    const iso = new Date(visitAt).toISOString()
    const result = await onSchedule({ complaintId, visitAt: iso })
    setLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Could not schedule visit.')
      return
    }
    setVisitAt('')
    onSuccess?.()
  }

  const buttonText =
    submitLabel ??
    (scheduledVisitAt ? 'Update agreed visit time' : 'Confirm visit with guest')

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarClock
          className={`h-4 w-4 ${isDark ? 'text-[#D4A62E]' : 'text-[#3C216C]'}`}
        />
        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-[#3C216C]'}`}>
          {title}
        </p>
      </div>
      {hint && (
        <p className={`text-xs leading-relaxed ${isDark ? 'text-white/70' : 'text-muted-foreground'}`}>
          {hint}
        </p>
      )}
      {scheduledVisitAt && (
        <p className={`text-sm ${isDark ? 'text-[#D4A62E]' : 'text-foreground'}`}>
          {formatComplaintVisit(scheduledVisitAt)}
        </p>
      )}
      <input
        type="datetime-local"
        value={visitAt}
        onChange={(e) => setVisitAt(e.target.value)}
        disabled={disabled || loading}
        className={
          isDark
            ? 'w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white'
            : 'mt-2 w-full rounded-xl border-0 bg-white px-4 py-3 text-sm text-foreground shadow-elevation-1 outline-none'
        }
      />
      {error && (
        <p className={`text-sm ${isDark ? 'text-red-200' : 'text-red-600'}`}>{error}</p>
      )}
      <button
        type="submit"
        disabled={disabled || loading || !visitAt}
        className={
          isDark
            ? 'w-full rounded-xl bg-[#3C216C] py-2.5 text-sm font-semibold text-white disabled:opacity-50'
            : 'w-full rounded-xl bg-[#3C216C] py-2.5 text-sm font-semibold text-white shadow-elevation-1 disabled:opacity-50'
        }
      >
        {loading ? 'Saving…' : buttonText}
      </button>
    </form>
  )
}

/** Read-only visit time for guest and manager views. */
export function ScheduledVisitDisplay({
  scheduledVisitAt,
  variant = 'light',
  pendingMessage,
}: {
  scheduledVisitAt: string | null
  variant?: 'dark' | 'light'
  pendingMessage?: string
}) {
  const isDark = variant === 'dark'

  if (scheduledVisitAt) {
    return (
      <div className="flex items-start gap-2">
        <CalendarClock
          className={`mt-0.5 h-4 w-4 shrink-0 ${isDark ? 'text-[#D4A62E]' : 'text-[#3C216C]'}`}
        />
        <div>
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              isDark ? 'text-white/80' : 'text-muted-foreground'
            }`}
          >
            Agreed visit
          </p>
          <p className={`mt-1 text-sm font-medium ${isDark ? 'text-[#D4A62E]' : 'text-foreground'}`}>
            {formatComplaintVisit(scheduledVisitAt)}
          </p>
        </div>
      </div>
    )
  }

  if (pendingMessage) {
    return (
      <p className={`text-xs leading-relaxed ${isDark ? 'text-white/60' : 'text-muted-foreground'}`}>
        {pendingMessage}
      </p>
    )
  }

  return null
}

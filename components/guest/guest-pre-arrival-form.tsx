'use client'

import { useState } from 'react'
import { Upload, Check } from 'lucide-react'
import { submitGuestPreArrival, updateGuestContactEmail } from '@/app/actions/guest-portal'

interface GuestPreArrivalFormProps {
  initialEmail: string | null
  initialEta: string | null
  initialNotes: string | null
  submittedAt: string | null
}

export function GuestPreArrivalForm({
  initialEmail,
  initialEta,
  initialNotes,
  submittedAt,
}: GuestPreArrivalFormProps) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [eta, setEta] = useState(initialEta ?? '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [idFile, setIdFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(Boolean(submittedAt))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (email.trim()) {
      const emailResult = await updateGuestContactEmail(email.trim())
      if (!emailResult.success) {
        setLoading(false)
        setError(emailResult.error ?? 'Could not save email.')
        return
      }
    }

    const formData = new FormData()
    formData.set('eta', eta)
    formData.set('notes', notes)
    if (idFile) formData.set('idDocument', idFile)

    const result = await submitGuestPreArrival(formData)
    setLoading(false)
    if (!result.success) {
      setError(result.error ?? 'Could not save details.')
      return
    }
    setDone(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-white/60">
        Share your contact email, estimated arrival, and optional ID for a smoother check-in.
      </p>
      {done && (
        <p className="flex items-center gap-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" />
          Details saved — you can update anytime.
        </p>
      )}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email for receipts & updates"
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/35"
      />
      <input
        type="text"
        value={eta}
        onChange={(e) => setEta(e.target.value)}
        placeholder="Estimated arrival (e.g. 3:00 PM tomorrow)"
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/35"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Special requests for your arrival…"
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm placeholder:text-white/35"
      />
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-3 text-sm text-white/70">
        <Upload className="h-4 w-4 shrink-0" />
        {idFile ? idFile.name : 'Upload ID (optional, JPG/PNG/PDF)'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && <p className="text-sm text-red-200">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#3C216C] py-3 text-sm font-semibold disabled:opacity-50"
      >
        {loading ? 'Saving…' : done ? 'Update details' : 'Save arrival details'}
      </button>
    </form>
  )
}

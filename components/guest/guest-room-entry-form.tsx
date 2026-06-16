'use client'

import { useState } from 'react'
import { enterGuestPortalByRoom } from '@/app/actions/guest-portal'

interface GuestRoomEntryFormProps {
  slug: string
  hotelName: string
}

export function GuestRoomEntryForm({ slug, hotelName }: GuestRoomEntryFormProps) {
  const [roomNumber, setRoomNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await enterGuestPortalByRoom({ slug, roomNumber })
    setLoading(false)
    if (!result.success) {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-dvh bg-[#22124C] px-6 py-10 text-white">
      <div className="mx-auto max-w-md text-center">
        <p className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-[#D4A62E]">
          MOJO APARTMENTS
        </p>
        <p className="mt-3 text-lg text-white/90">{hotelName}</p>
        <p className="mt-2 text-sm text-white/70">Enter your room number to open the guest portal.</p>
      </div>

      <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-md space-y-4">
        <div>
          <label htmlFor="roomNumber" className="mb-2 block text-sm font-medium text-white/90">
            Room number
          </label>
          <input
            id="roomNumber"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoFocus
            required
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="e.g. 12 or B204"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-center text-lg font-semibold text-white placeholder:text-white/40"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !roomNumber.trim()}
          className="w-full rounded-xl bg-[#3C216C] py-4 text-lg font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Opening…' : 'Continue'}
        </button>

        <p className="text-center text-xs text-white/50">
          Checked in guests only. If you need help, contact the front desk.
        </p>
      </form>
    </div>
  )
}

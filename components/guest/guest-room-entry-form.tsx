'use client'

import { useState } from 'react'
import { enterGuestPortalByRoom } from '@/app/actions/guest-portal'

interface GuestRoomEntryFormProps {
  slug: string
  hotelName: string
}

export function GuestRoomEntryForm({ slug, hotelName }: GuestRoomEntryFormProps) {
  const [roomNumber, setRoomNumber] = useState('')
  const [guestLastName, setGuestLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await enterGuestPortalByRoom({ slug, roomNumber, guestLastName })
    setLoading(false)
    if (!result.success) {
      setError(result.error)
    }
  }

  return (
    <div className="guest-auth-shell">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <div className="text-center">
          <p className="guest-auth-brand">MOJO APARTMENTS</p>
          <p className="mt-2 text-lg">{hotelName}</p>
          <p className="mt-2 text-sm leading-relaxed guest-text-muted">
            Enter your room number to open the guest portal.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="guestLastName" className="mb-2 block text-sm font-medium">
              Last name on booking
            </label>
            <input
              id="guestLastName"
              type="text"
              autoComplete="family-name"
              required
              value={guestLastName}
              onChange={(e) => setGuestLastName(e.target.value)}
              placeholder="As shown on your reservation"
              className="guest-field"
            />
          </div>

          <div>
            <label htmlFor="roomNumber" className="mb-2 block text-sm font-medium">
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
              className="guest-field text-center text-lg font-semibold"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !roomNumber.trim() || !guestLastName.trim()}
            className="guest-btn guest-btn-primary w-full py-3.5 text-base disabled:opacity-50"
          >
            {loading ? 'Opening…' : 'Continue'}
          </button>

          <p className="text-center text-xs guest-text-subtle">
            Checked-in guests only. Contact the front desk if you need help.
          </p>
        </form>
      </div>
    </div>
  )
}

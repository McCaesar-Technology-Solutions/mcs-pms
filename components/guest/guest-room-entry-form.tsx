'use client'

import { useState } from 'react'
import { enterGuestPortalByRoom } from '@/app/actions/guest-portal'

interface GuestRoomEntryFormProps {
  slug: string
  hotelName: string
}

export function GuestRoomEntryForm({ slug, hotelName }: GuestRoomEntryFormProps) {
  const [roomNumber, setRoomNumber] = useState('')
  const [portalPin, setPortalPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await enterGuestPortalByRoom({ slug, roomNumber, portalPin })
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
            Enter your room number and the 4-digit PIN you received at check-in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          <div>
            <label htmlFor="portalPin" className="mb-2 block text-sm font-medium">
              Access PIN
            </label>
            <input
              id="portalPin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="one-time-code"
              required
              value={portalPin}
              onChange={(e) => setPortalPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-digit PIN"
              className="guest-field text-center text-lg font-semibold tracking-[0.5em]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !roomNumber.trim() || portalPin.length < 4}
            className="guest-btn guest-btn-primary w-full py-3.5 text-base disabled:opacity-50"
          >
            {loading ? 'Opening…' : 'Continue'}
          </button>

          <p className="text-center text-xs guest-text-subtle">
            Checked-in guests only. Your PIN is on your check-in slip — ask the front desk if you
            need it again.
          </p>
        </form>
      </div>
    </div>
  )
}

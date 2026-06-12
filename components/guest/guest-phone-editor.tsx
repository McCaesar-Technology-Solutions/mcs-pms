'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { updateGuestPhone } from '@/app/actions/guest'
import { hasPhoneNumber } from '@/lib/phone'

interface GuestPhoneEditorProps {
  initialPhone?: string | null
}

export function GuestPhoneEditor({ initialPhone }: GuestPhoneEditorProps) {
  const router = useRouter()
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [editing, setEditing] = useState(!hasPhoneNumber(initialPhone))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateGuestPhone(phone)
      if (result.success) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Could not save.')
      }
    })
  }

  if (hasPhoneNumber(initialPhone) && !editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-white/5 px-4 py-3">
        <div>
          <p className="text-xs text-white/60">Your contact number</p>
          <p className="text-sm font-medium">{initialPhone}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPhone(initialPhone ?? '')
            setEditing(true)
            setError(null)
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#D4A62E] hover:underline"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-white/20 bg-white/5 p-4">
      <label htmlFor="guest-phone" className="mb-2 block text-xs text-white/60">
        {initialPhone ? 'Update your contact number' : 'Add your contact number'}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="guest-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+233 XX XXX XXXX"
          required
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <div className="flex gap-2">
          {initialPhone && (
            <button
              type="button"
              onClick={() => {
                setPhone(initialPhone ?? '')
                setEditing(false)
                setError(null)
              }}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending || !phone.trim()}
            className="rounded-lg bg-[#3C216C] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </form>
  )
}

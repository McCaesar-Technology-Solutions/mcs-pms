'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import { updateProfilePhone } from '@/app/actions/profile'

interface ProfilePhoneBannerProps {
  roleLabel: string
}

export function ProfilePhoneBanner({ roleLabel }: ProfilePhoneBannerProps) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateProfilePhone(phone)
      if (result.success) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <form onSubmit={save} className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Phone className="h-4 w-4" />
            Add your phone number
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            As a {roleLabel}, your number lets guests and teammates reach you by phone.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 XX XXX XXXX"
            required
            className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm sm:w-48"
          />
          <button
            type="submit"
            disabled={pending || !phone.trim()}
            className="rounded-lg bg-[#3C216C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </div>
  )
}

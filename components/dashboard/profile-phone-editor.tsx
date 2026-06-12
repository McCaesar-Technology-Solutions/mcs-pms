'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import { updateProfilePhone } from '@/app/actions/profile'
import { hasPhoneNumber } from '@/lib/phone'

interface ProfilePhoneEditorProps {
  initialPhone?: string | null
  roleLabel: string
  variant?: 'banner' | 'card' | 'inline' | 'embedded'
}

export function ProfilePhoneEditor({
  initialPhone,
  roleLabel,
  variant = 'card',
}: ProfilePhoneEditorProps) {
  const router = useRouter()
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [editing, setEditing] = useState(variant === 'embedded' || !hasPhoneNumber(initialPhone))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setPhone(initialPhone ?? '')
    if (variant !== 'embedded') {
      setEditing(!hasPhoneNumber(initialPhone))
    }
  }, [initialPhone, variant])

  function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateProfilePhone(phone)
      if (result.success) {
        setEditing(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (variant === 'inline' && hasPhoneNumber(initialPhone) && !editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Your phone: <span className="font-medium text-foreground">{initialPhone}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setPhone(initialPhone ?? '')
            setEditing(true)
            setError(null)
          }}
          className="text-xs font-semibold text-[#3C216C] hover:underline"
        >
          Edit
        </button>
      </div>
    )
  }

  if (variant === 'card' && hasPhoneNumber(initialPhone) && !editing) {
    return (
      <div className="surface-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3C216C]/10 text-[#3C216C]">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Your phone number</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{initialPhone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPhone(initialPhone ?? '')
              setEditing(true)
              setError(null)
            }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  const form = (
    <form onSubmit={save} className={variant === 'banner' ? 'mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-end' : 'space-y-3'}>
      {variant === 'card' && (
        <div>
          <h3 className="text-lg font-semibold text-foreground">Your phone number</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Used for SMS notifications and so guests can reach you.
          </p>
        </div>
      )}
      {variant === 'embedded' && (
        <div>
          <p className="text-sm text-muted-foreground">
            Ghana format, e.g. +233 24 123 4567
          </p>
        </div>
      )}
      {variant === 'banner' && (
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Phone className="h-4 w-4" />
            {initialPhone ? 'Update your phone number' : 'Add your phone number'}
          </p>
          <p className="mt-0.5 text-xs text-amber-800/80">
            As a {roleLabel}, your number lets guests and teammates reach you by phone.
          </p>
        </div>
      )}
      <div className={variant === 'banner' ? 'flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center' : variant === 'inline' ? 'space-y-2' : 'flex flex-col gap-2 sm:flex-row sm:items-center'}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+233 XX XXX XXXX"
          required
          className={
            variant === 'banner'
              ? 'w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm sm:w-48'
              : variant === 'inline'
                ? 'w-full rounded-lg border border-border px-3 py-2 text-sm'
                : 'w-full rounded-lg border border-border px-3 py-2 text-sm sm:max-w-xs'
          }
        />
        <div className="flex gap-2">
          {(variant === 'card' || variant === 'inline') && hasPhoneNumber(initialPhone) && (
            <button
              type="button"
              onClick={() => {
                setPhone(initialPhone ?? '')
                setEditing(false)
                setError(null)
              }}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={pending || !phone.trim()}
            className={
              variant === 'banner'
                ? 'rounded-lg bg-[#3C216C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
                : 'rounded-lg bg-[#3C216C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'
            }
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && (
        <p className={variant === 'banner' ? 'text-xs text-red-600 sm:col-span-2' : 'text-sm text-destructive'}>
          {error}
        </p>
      )}
    </form>
  )

  if (variant === 'banner') {
    return <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">{form}</div>
  }

  if (variant === 'inline' || variant === 'embedded') {
    return <div>{form}</div>
  }

  return <div className="surface-card p-6">{form}</div>
}

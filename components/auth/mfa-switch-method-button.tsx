'use client'

import { useState } from 'react'
import { resetMfaEnrollmentChoice, switchMfaMethod } from '@/app/actions/mfa'
import { MFA_METHOD_LABELS, type MfaMethod } from '@/lib/auth/mfa'

interface MfaSwitchMethodButtonProps {
  current: MfaMethod
  nextPath: string
  disabled?: boolean
}

/** First-time 2FA setup only — switch SMS ↔ email if the other channel was picked by mistake. */
export function MfaSwitchMethodButton({
  current,
  nextPath,
  disabled,
}: MfaSwitchMethodButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next: MfaMethod = current === 'email' ? 'sms' : 'email'

  async function handleSwitch() {
    setPending(true)
    setError(null)
    const result = await switchMfaMethod(next, nextPath)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    window.location.assign(result.data?.redirectTo ?? '/enroll-mfa')
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleSwitch()}
        disabled={disabled || pending}
        className="w-full text-center text-xs font-semibold text-white/70 hover:text-white hover:underline disabled:opacity-50"
      >
        {pending ? 'Switching…' : `Use ${MFA_METHOD_LABELS[next].toLowerCase()} instead`}
      </button>
      {error && (
        <p className="text-center text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

interface MfaChooseDifferentMethodButtonProps {
  nextPath: string
  disabled?: boolean
}

/** First-time 2FA setup only — return to SMS vs email picker without signing out. */
export function MfaChooseDifferentMethodButton({
  nextPath,
  disabled,
}: MfaChooseDifferentMethodButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setPending(true)
    setError(null)
    const result = await resetMfaEnrollmentChoice(nextPath)
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    window.location.assign(result.data?.redirectTo ?? '/enroll-mfa')
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleReset()}
        disabled={disabled || pending}
        className="w-full text-center text-xs font-semibold text-white/70 hover:text-white hover:underline disabled:opacity-50"
      >
        {pending ? 'Switching…' : 'Choose a different method'}
      </button>
      {error && (
        <p className="text-center text-xs text-red-200" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

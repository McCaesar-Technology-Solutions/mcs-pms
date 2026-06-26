'use client'

import { useEffect, useState } from 'react'
import { getMfaStatus } from '@/app/actions/mfa'
import { MfaEmailForm } from '@/components/auth/mfa-email-form'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'

interface MfaVerifyFormProps {
  nextPath: string
}

/** Sign-in verification — SMS or email code depending on account settings. */
export function MfaVerifyForm({ nextPath }: MfaVerifyFormProps) {
  const [method, setMethod] = useState<'sms' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const result = await getMfaStatus()
        if (cancelled) return

        if (!result.success) {
          setError(result.error)
          return
        }
        if (result.data?.method === 'sms' || result.data?.method === 'email') {
          setMethod(result.data.method)
        } else {
          setError('Sign-in verification is not enabled for this account.')
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load verification. Refresh the page and try again.',
          )
        }
      }
    }

    void init()
  }, [])

  if (error) {
    return <p className="text-sm text-red-200">{error}</p>
  }

  if (!method) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  if (method === 'email') {
    return <MfaEmailForm nextPath={nextPath} mode="verify" />
  }

  return <MfaSmsForm nextPath={nextPath} mode="verify" />
}

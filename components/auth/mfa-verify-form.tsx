'use client'

import { useEffect, useState } from 'react'
import { getMfaStatus } from '@/app/actions/mfa'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'
import { MfaTotpForm } from '@/components/auth/mfa-totp-form'

interface MfaVerifyFormProps {
  nextPath: string
}

export function MfaVerifyForm({ nextPath }: MfaVerifyFormProps) {
  const [method, setMethod] = useState<'sms' | 'totp' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getMfaStatus().then((result) => {
      if (!result.success) {
        setError(result.error)
        return
      }
      if (!result.data) {
        setError('Could not load verification settings.')
        return
      }
      setMethod(result.data.method)
    })
  }, [])

  if (error) {
    return <p className="text-sm text-red-200">{error}</p>
  }

  if (!method) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  if (method === 'totp') {
    return <MfaTotpForm nextPath={nextPath} />
  }

  return <MfaSmsForm nextPath={nextPath} mode="verify" />
}

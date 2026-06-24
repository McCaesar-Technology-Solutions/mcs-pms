'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMfaStatus } from '@/app/actions/mfa'
import { MfaEmailForm } from '@/components/auth/mfa-email-form'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'

interface MfaEnrollFormProps {
  nextPath: string
}

/** Complete 2FA setup when enabled but contact info is missing. */
export function MfaEnrollForm({ nextPath }: MfaEnrollFormProps) {
  const router = useRouter()
  const [method, setMethod] = useState<'sms' | 'email' | null>(null)
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

      if (!result.data.enabled || !result.data.method) {
        router.replace(nextPath)
        return
      }

      setMethod(result.data.method)
    })
  }, [nextPath, router])

  if (error) {
    return <p className="text-sm text-red-200">{error}</p>
  }

  if (!method) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  if (method === 'email') {
    return <MfaEmailForm nextPath={nextPath} mode="setup" />
  }

  return <MfaSmsForm nextPath={nextPath} mode="setup" />
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMfaStatus } from '@/app/actions/mfa'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'

interface MfaEnrollFormProps {
  nextPath: string
}

/** Complete SMS 2FA setup when enabled but no phone on file. TOTP is configured in Settings only. */
export function MfaEnrollForm({ nextPath }: MfaEnrollFormProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
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

      if (!result.data.enabled) {
        router.replace(nextPath)
        return
      }

      if (result.data.method === 'totp') {
        const settingsPath = nextPath.startsWith('/manager')
          ? '/manager/staff'
          : nextPath.startsWith('/receptionist')
            ? '/receptionist/staff'
            : nextPath.startsWith('/technician')
              ? '/technician/dashboard'
              : '/owner/settings'
        router.replace(settingsPath)
        return
      }

      setReady(true)
    })
  }, [nextPath, router])

  if (error) {
    return <p className="text-sm text-red-200">{error}</p>
  }

  if (!ready) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  return <MfaSmsForm nextPath={nextPath} mode="setup" />
}

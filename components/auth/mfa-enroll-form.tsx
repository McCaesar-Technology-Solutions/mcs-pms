'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Smartphone } from 'lucide-react'
import { enableEmailMfa, enableSmsMfa, getMfaStatus } from '@/app/actions/mfa'
import { MFA_METHOD_LABELS, type MfaMethod } from '@/lib/auth/mfa'
import { MfaEmailForm } from '@/components/auth/mfa-email-form'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'

interface MfaEnrollFormProps {
  nextPath: string
}

type EnrollPhase = 'loading' | 'pick' | 'setup'

/** Complete 2FA setup when required but not yet configured (new owners, manual Supabase accounts). */
export function MfaEnrollForm({ nextPath }: MfaEnrollFormProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<EnrollPhase>('loading')
  const [method, setMethod] = useState<MfaMethod | null>(null)
  const [hasEmail, setHasEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const bootstrap = useCallback(async () => {
    try {
      const result = await getMfaStatus()
      if (!result.success) {
        setError(result.error)
        setPhase('pick')
        return
      }
      if (!result.data) {
        setError('Could not load verification settings.')
        setPhase('pick')
        return
      }

      const data = result.data
      setHasEmail(data.hasEmail)

      if (data.sessionVerified && data.enabled && data.method) {
        router.replace(nextPath)
        return
      }

      if (data.method === 'sms' || data.method === 'email') {
        setMethod(data.method)
        setPhase('setup')
        return
      }

      setPhase('pick')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load verification settings.')
      setPhase('pick')
    }
  }, [nextPath, router])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  async function chooseMethod(next: MfaMethod) {
    setError(null)
    setPending(true)
    const result = next === 'sms' ? await enableSmsMfa() : await enableEmailMfa()
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setMethod(next)
    setPhase('setup')
  }

  if (phase === 'loading') {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  if (phase === 'pick') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/75">
          Choose how you want to receive sign-in codes. You&apos;ll confirm with a one-time code to
          finish setup.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            onClick={() => void chooseMethod('sms')}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand-gold)] px-4 py-3 text-sm font-semibold text-[var(--brand-purple-ink)] transition hover:brightness-105 disabled:opacity-60"
          >
            <Smartphone className="h-4 w-4" aria-hidden />
            {MFA_METHOD_LABELS.sms}
          </button>
          <button
            type="button"
            disabled={pending || !hasEmail}
            onClick={() => void chooseMethod('email')}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-4 w-4" aria-hidden />
            {MFA_METHOD_LABELS.email}
          </button>
        </div>
        {!hasEmail && (
          <p className="text-xs text-white/55">
            Email verification needs an address on your profile. Add your email in the Supabase{' '}
            <code className="text-white/70">profiles</code> row, then refresh this page.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-200" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  if (method === 'email') {
    return <MfaEmailForm nextPath={nextPath} mode="setup" />
  }

  if (method === 'sms') {
    return <MfaSmsForm nextPath={nextPath} mode="setup" />
  }

  return (
    <p className="text-sm text-red-200" role="alert">
      {error ?? 'Could not start verification setup. Refresh and try again.'}
    </p>
  )
}

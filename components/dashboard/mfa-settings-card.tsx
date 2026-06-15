'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isMfaRequired } from '@/lib/auth/mfa'
import { MfaEnrollForm } from '@/components/auth/mfa-enroll-form'
import type { UserRole } from '@/types'

interface MfaSettingsCardProps {
  role: UserRole
  /** Where to return after optional enrollment from settings. */
  returnPath: string
}

export function MfaSettingsCard({ role, returnPath }: MfaSettingsCardProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const required = isMfaRequired(role)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = (factors?.totp ?? []).some((f) => f.status === 'verified')
    setEnabled(verified)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleRemove() {
    if (required) return
    setError(null)
    setPending(true)

    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = (factors?.totp ?? []).find((f) => f.status === 'verified')

    if (!verified) {
      setPending(false)
      await refresh()
      return
    }

    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: verified.id })
    setPending(false)

    if (unenrollError) {
      setError('Could not remove two-factor authentication. Try again.')
      return
    }

    await refresh()
    router.refresh()
  }

  if (enrolling) {
    return (
      <div className="surface-card overflow-hidden p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#3C216C]" />
          <h3 className="text-lg font-semibold text-foreground">Set up authenticator</h3>
        </div>
        <div className="rounded-xl bg-[#22124C] p-5">
          <MfaEnrollForm nextPath={returnPath} required={required} />
        </div>
        {!required && (
          <button
            type="button"
            onClick={() => setEnrolling(false)}
            className="mt-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3C216C]/10 text-[#3C216C]">
          {enabled ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Two-factor authentication</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {required
              ? 'Required for your role — use an authenticator app at sign-in.'
              : 'Optional — add an authenticator app for extra account security.'}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 p-4">
        {enabled === null ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : enabled ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Enabled
            </span>
            {!required && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={pending}
                className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEnrolling(true)}
            className="rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4c2a85]"
          >
            Set up authenticator app
          </button>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ShieldCheck } from 'lucide-react'
import { getMfaSmsStatus, setMfaSmsEnabled } from '@/app/actions/mfa'
import { isMfaRequired } from '@/lib/auth/mfa'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'
import type { UserRole } from '@/types'

interface MfaSettingsCardProps {
  role: UserRole
  returnPath: string
}

export function MfaSettingsCard({ role, returnPath }: MfaSettingsCardProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [hasPhone, setHasPhone] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const required = isMfaRequired(role)

  const refresh = useCallback(async () => {
    const result = await getMfaSmsStatus()
    if (!result.success || !result.data) {
      setEnabled(null)
      return
    }
    setEnabled(result.data.enabled)
    setHasPhone(result.data.hasPhone)
    setMaskedPhone(result.data.maskedPhone)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleEnable() {
    if (required) {
      setEnrolling(true)
      return
    }
    setError(null)
    const result = await setMfaSmsEnabled(true)
    if (!result.success) {
      setError(result.error)
      return
    }
    setEnrolling(true)
    await refresh()
  }

  async function handleDisable() {
    if (required) return
    setError(null)
    setPending(true)
    const result = await setMfaSmsEnabled(false)
    setPending(false)
    if (!result.success) {
      setError(result.error)
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
          <h3 className="text-lg font-semibold text-foreground">Verify your phone</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          We&apos;ll send a one-time SMS code to confirm your number.
        </p>
        <div className="rounded-xl bg-[#22124C] p-5">
          <MfaSmsForm nextPath={returnPath} mode="setup" />
        </div>
        {!required && (
          <button
            type="button"
            onClick={() => {
              setEnrolling(false)
              void setMfaSmsEnabled(false)
              void refresh()
            }}
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
          <h3 className="text-lg font-semibold text-foreground">SMS verification</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {required
              ? 'Required for your role — we text a code to your phone at each sign-in.'
              : 'Optional — receive a text message code when you sign in.'}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 p-4">
        {enabled === null ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : enabled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {required ? 'Required & active' : 'Enabled'}
              </span>
              {!required && (
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={pending}
                  className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                >
                  Turn off
                </button>
              )}
            </div>
            {maskedPhone && (
              <p className="text-sm text-muted-foreground">Codes are sent to {maskedPhone}</p>
            )}
            {!hasPhone && (
              <button
                type="button"
                onClick={() => setEnrolling(true)}
                className="text-sm font-semibold text-[#3C216C] hover:underline"
              >
                Add phone number
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleEnable}
            className="rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4c2a85]"
          >
            Enable SMS verification
          </button>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

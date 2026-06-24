'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ShieldCheck, Smartphone } from 'lucide-react'
import { disableMfa, enableSmsMfa, getMfaStatus } from '@/app/actions/mfa'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'
import type { UserRole } from '@/types'

interface MfaSettingsCardProps {
  role: UserRole
  returnPath: string
}

export function MfaSettingsCard({ role, returnPath }: MfaSettingsCardProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [setupSms, setSetupSms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await getMfaStatus()
    setLoading(false)
    if (!result.success || !result.data) return
    setEnabled(result.data.enabled)
    setHasPhone(result.data.hasPhone)
    setMaskedPhone(result.data.maskedPhone)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleDisable() {
    setError(null)
    setPending(true)
    const result = await disableMfa()
    setPending(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setSetupSms(false)
    await refresh()
    router.refresh()
  }

  async function startSmsSetup() {
    setError(null)
    const result = await enableSmsMfa()
    if (!result.success) {
      setError(result.error)
      return
    }
    setSetupSms(true)
    await refresh()
  }

  if (setupSms) {
    return (
      <div className="surface-card overflow-hidden p-6">
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-[#3C216C]" />
          <h3 className="text-lg font-semibold text-foreground">Set up SMS verification</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          We&apos;ll text a 6-digit code to your phone when you sign in. Add your number below if
          needed, then enter the code we send.
        </p>
        <div className="rounded-xl bg-[#22124C] p-5">
          <MfaSmsForm nextPath={returnPath} mode="setup" />
        </div>
        <button
          type="button"
          onClick={() => {
            void disableMfa()
            setSetupSms(false)
            void refresh()
          }}
          className="mt-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
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
          <h3 className="text-lg font-semibold text-foreground">SMS sign-in verification</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional extra protection for {role.replace('_', ' ')} accounts — a one-time code by
            text at sign-in. Operational alerts (bookings, complaints, staff invites) use SMS and
            email separately under notification settings below.
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : enabled ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Enabled · SMS
              </span>
              <button
                type="button"
                onClick={handleDisable}
                disabled={pending}
                className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                Turn off
              </button>
            </div>
            {maskedPhone && (
              <p className="text-sm text-muted-foreground">Codes are sent to {maskedPhone}</p>
            )}
            {!hasPhone && (
              <button
                type="button"
                onClick={() => setSetupSms(true)}
                className="text-sm font-semibold text-[#3C216C] hover:underline"
              >
                Add phone number
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void startSmsSetup()}
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

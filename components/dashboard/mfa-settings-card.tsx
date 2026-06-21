'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, ShieldCheck, Smartphone, KeyRound } from 'lucide-react'
import {
  disableMfa,
  enableSmsMfa,
  getMfaStatus,
} from '@/app/actions/mfa'
import { MFA_METHOD_LABELS, type MfaMethod } from '@/lib/auth/mfa'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'
import { MfaTotpSetupPanel } from '@/components/auth/mfa-totp-setup-panel'
import type { UserRole } from '@/types'

interface MfaSettingsCardProps {
  role: UserRole
  returnPath: string
}

type SetupView = 'none' | 'pick-method' | 'sms' | 'totp'

export function MfaSettingsCard({ role, returnPath }: MfaSettingsCardProps) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(false)
  const [method, setMethod] = useState<MfaMethod | null>(null)
  const [hasPhone, setHasPhone] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [setupView, setSetupView] = useState<SetupView>('none')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await getMfaStatus()
    setLoading(false)
    if (!result.success || !result.data) return
    setEnabled(result.data.enabled)
    setMethod(result.data.method)
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
    setSetupView('none')
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
    setSetupView('sms')
    await refresh()
  }

  function finishSetup() {
    setSetupView('none')
    void refresh()
    router.refresh()
  }

  if (setupView === 'sms') {
    return (
      <div className="surface-card overflow-hidden p-6">
        <div className="mb-4 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-[#3C216C]" />
          <h3 className="text-lg font-semibold text-foreground">Set up SMS verification</h3>
        </div>
        <div className="rounded-xl bg-[#22124C] p-5">
          <MfaSmsForm nextPath={returnPath} mode="setup" />
        </div>
        <button
          type="button"
          onClick={() => {
            void disableMfa()
            setSetupView('none')
            void refresh()
          }}
          className="mt-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (setupView === 'totp') {
    return (
      <div className="surface-card overflow-hidden p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-[#3C216C]" />
          <h3 className="text-lg font-semibold text-foreground">Set up authenticator app</h3>
        </div>
        <MfaTotpSetupPanel
          nextPath={returnPath}
          variant="settings"
          onComplete={finishSetup}
          onCancel={() => setSetupView('none')}
        />
      </div>
    )
  }

  if (setupView === 'pick-method') {
    return (
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header">
          <h3 className="text-lg font-semibold text-foreground">Choose a verification method</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick how you want to confirm sign-in when two-factor authentication is on.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void startSmsSetup()}
            className="surface-inset rounded-xl p-4 text-left transition-shadow hover:shadow-elevation-1"
          >
            <Smartphone className="mb-2 h-6 w-6 text-[#3C216C]" />
            <p className="font-semibold text-foreground">{MFA_METHOD_LABELS.sms}</p>
            <p className="mt-1 text-xs text-muted-foreground">Receive a one-time code by SMS at sign-in.</p>
          </button>
          <button
            type="button"
            onClick={() => setSetupView('totp')}
            className="surface-inset rounded-xl p-4 text-left transition-shadow hover:shadow-elevation-1"
          >
            <KeyRound className="mb-2 h-6 w-6 text-[#3C216C]" />
            <p className="font-semibold text-foreground">{MFA_METHOD_LABELS.totp}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Use Google Authenticator, Authy, or similar apps.
            </p>
          </button>
        </div>
        <div className="border-t border-border/60 px-4 py-3">
          <button
            type="button"
            onClick={() => setSetupView('none')}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
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
            Optional extra sign-in protection. Turn it on here — not required for {role.replace('_', ' ')}{' '}
            accounts unless you enable it.
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Checking status…</p>
        ) : enabled && method ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                Enabled · {MFA_METHOD_LABELS[method]}
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
            {method === 'sms' && maskedPhone && (
              <p className="text-sm text-muted-foreground">Codes are sent to {maskedPhone}</p>
            )}
            {method === 'sms' && !hasPhone && (
              <button
                type="button"
                onClick={() => setSetupView('sms')}
                className="text-sm font-semibold text-[#3C216C] hover:underline"
              >
                Add phone number
              </button>
            )}
            {method === 'totp' && (
              <button
                type="button"
                onClick={() => setSetupView('pick-method')}
                className="text-sm font-semibold text-[#3C216C] hover:underline"
              >
                Switch to SMS instead
              </button>
            )}
            {method === 'sms' && (
              <button
                type="button"
                onClick={() => setSetupView('totp')}
                className="text-sm font-semibold text-[#3C216C] hover:underline"
              >
                Switch to authenticator app
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSetupView('pick-method')}
            className="rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4c2a85]"
          >
            Enable two-factor authentication
          </button>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

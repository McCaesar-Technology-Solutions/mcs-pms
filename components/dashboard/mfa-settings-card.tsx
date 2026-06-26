'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Shield, ShieldCheck, Smartphone } from 'lucide-react'
import { disableMfa, enableEmailMfa, enableSmsMfa, getMfaStatus } from '@/app/actions/mfa'
import { MFA_METHOD_LABELS, safeMfaNext, type MfaMethod } from '@/lib/auth/mfa'
import { MfaEmailForm } from '@/components/auth/mfa-email-form'
import { MfaSmsForm } from '@/components/auth/mfa-sms-form'
import { MfaVerifyForm } from '@/components/auth/mfa-verify-form'
import type { UserRole } from '@/types'

interface MfaSettingsCardProps {
  role: UserRole
  returnPath: string
}

export function MfaSettingsCard({ role, returnPath }: MfaSettingsCardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = safeMfaNext(searchParams.get('next'), returnPath)
  const [enabled, setEnabled] = useState(false)
  const [method, setMethod] = useState<MfaMethod | null>(null)
  const [hasPhone, setHasPhone] = useState(false)
  const [hasEmail, setHasEmail] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [sessionVerified, setSessionVerified] = useState(true)
  const [setupMethod, setSetupMethod] = useState<MfaMethod | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await getMfaStatus()
    setLoading(false)
    if (!result.success || !result.data) {
      if (!result.success) setError(result.error)
      return
    }
    setEnabled(result.data.enabled)
    setMethod(result.data.method)
    setHasPhone(result.data.hasPhone)
    setHasEmail(result.data.hasEmail)
    setMaskedPhone(result.data.maskedPhone)
    setMaskedEmail(result.data.maskedEmail)
    setSessionVerified(result.data.sessionVerified)
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
    setSetupMethod(null)
    await refresh()
    router.refresh()
  }

  async function startSetup(next: MfaMethod) {
    setError(null)
    if (next === 'sms' && !hasPhone) {
      const result = await enableSmsMfa()
      if (!result.success) {
        setError(result.error)
        return
      }
      setSetupMethod('sms')
      await refresh()
      return
    }

    if (next === 'email' && !hasEmail) {
      setError('Your account has no email address. Contact an administrator to update your profile.')
      return
    }

    const result = next === 'sms' ? await enableSmsMfa() : await enableEmailMfa()
    if (!result.success) {
      setError(result.error)
      return
    }
    setSetupMethod(next)
    await refresh()
  }

  if (setupMethod) {
    const isSms = setupMethod === 'sms'
    return (
      <div className="surface-card overflow-hidden p-6">
        <div className="mb-4 flex items-center gap-2">
          {isSms ? (
            <Smartphone className="h-5 w-5 text-[#3C216C]" />
          ) : (
            <Mail className="h-5 w-5 text-[#3C216C]" />
          )}
          <h3 className="text-lg font-semibold text-foreground">
            Set up {MFA_METHOD_LABELS[setupMethod].toLowerCase()} verification
          </h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {isSms
            ? "We'll text a 6-digit code to your phone when you sign in. Add your number below if needed, then enter the code we send."
            : "We'll email a 6-digit code to your account address when you sign in. Enter the code we send to finish setup."}
        </p>
        <div className="rounded-xl bg-[#22124C] p-5">
          {isSms ? (
            <MfaSmsForm nextPath={nextPath} mode="setup" />
          ) : (
            <MfaEmailForm nextPath={nextPath} mode="setup" />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void disableMfa()
            setSetupMethod(null)
            void refresh()
          }}
          className="mt-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (enabled && method && !sessionVerified) {
    return (
      <div className="surface-card overflow-hidden p-6">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#3C216C]" />
          <h3 className="text-lg font-semibold text-foreground">Verify this sign-in</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Two-factor sign-in is enabled. Enter the code we send to your{' '}
          {method === 'sms' ? 'phone' : 'email'} to continue using the app.
        </p>
        <div className="rounded-xl bg-[#22124C] p-5">
          <MfaVerifyForm nextPath={nextPath} />
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
          <h3 className="text-lg font-semibold text-foreground">Sign-in verification</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional extra protection for {role.replace('_', ' ')} accounts — a one-time code by
            text or email at sign-in. Operational alerts (bookings, complaints, staff invites) use
            the notification settings below and are separate from this.
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
            {method === 'email' && maskedEmail && (
              <p className="text-sm text-muted-foreground">Codes are sent to {maskedEmail}</p>
            )}
            {method === 'sms' && !hasPhone && (
              <button
                type="button"
                onClick={() => void startSetup('sms')}
                className="text-sm font-semibold text-[#3C216C] hover:underline"
              >
                Add phone number
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose how you want to receive sign-in codes:</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void startSetup('sms')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3C216C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4c2a85]"
              >
                <Smartphone className="h-4 w-4" />
                Enable SMS
              </button>
              <button
                type="button"
                onClick={() => void startSetup('email')}
                disabled={!hasEmail}
                className="inline-flex items-center gap-2 rounded-xl border border-[#3C216C]/30 bg-background px-4 py-2.5 text-sm font-semibold text-[#3C216C] hover:bg-[#3C216C]/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                Enable email
              </button>
            </div>
            {!hasEmail && (
              <p className="text-xs text-muted-foreground">
                Email verification requires an address on your staff profile.
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}

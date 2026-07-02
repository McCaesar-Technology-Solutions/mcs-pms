'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getMfaStatus, sendMfaEmailCode, verifyMfaEmailCode } from '@/app/actions/mfa'
import { safeMfaNext } from '@/lib/auth/mfa'

interface MfaEmailFormProps {
  nextPath: string
  mode: 'setup' | 'verify'
}

export function MfaEmailForm({ nextPath, mode }: MfaEmailFormProps) {
  const router = useRouter()
  const destination = safeMfaNext(nextPath, '/')
  const [code, setCode] = useState('')
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  const deliverCode = useCallback(async () => {
    setSending(true)
    setError(null)
    const result = await sendMfaEmailCode()
    setSending(false)
    if (!result.success) {
      setError(result.error ?? 'Could not send the code.')
      return false
    }
    if (result.data) {
      setMaskedEmail(result.data.maskedEmail)
      setDevCode(result.data.devCode ?? null)
    }
    return true
  }, [])

  useEffect(() => {
    const cancelled = false

    async function init() {
      try {
        const status = await getMfaStatus()
        if (cancelled) return

        if (!status.success) {
          setError(status.error)
          setBootstrapping(false)
          return
        }

        const { hasEmail, maskedEmail: masked, method, sessionVerified } = status.data!

        if (mode === 'verify' && sessionVerified) {
          router.replace(destination)
          return
        }

        if (mode === 'setup' && (!hasEmail || method !== 'email')) {
          setError('Your account has no email on file. Update your profile and try again.')
          setBootstrapping(false)
          return
        }

        setMaskedEmail(masked)
        setBootstrapping(false)

        if (mode === 'verify' || hasEmail) {
          if (!sessionVerified) {
            await deliverCode()
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Could not load verification. Refresh the page and try again.'
          setError(message)
          setBootstrapping(false)
        }
      }
    }

    init()
  }, [mode, deliverCode, destination, router])

  async function handleResend() {
    await deliverCode()
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await verifyMfaEmailCode(code, destination)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    router.push(result.data?.redirectTo ?? destination)
    router.refresh()
  }

  if (bootstrapping) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <p className="text-sm text-white/70">
        {maskedEmail
          ? `Enter the 6-digit code we sent to ${maskedEmail}.`
          : 'Enter the 6-digit code from your email.'}
      </p>

      {devCode && (
        <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          Dev mode: your code is <span className="font-mono font-bold">{devCode}</span> (check the
          terminal if email is not configured).
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="mfa-email-code" className="text-white/90">
          Verification code
        </Label>
        <Input
          id="mfa-email-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          required
          minLength={6}
          maxLength={6}
          autoFocus
          className="auth-field text-center text-lg tracking-[0.3em]"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || code.length !== 6}
        className="auth-submit-btn"
      >
        {loading ? 'Verifying…' : 'Verify and continue'}
      </Button>

      <button
        type="button"
        onClick={handleResend}
        disabled={sending || loading}
        className="w-full text-center text-xs font-semibold text-[#D4A62E] hover:underline disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Resend code'}
      </button>
    </form>
  )
}

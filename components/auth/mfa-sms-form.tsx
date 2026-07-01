'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getMfaSmsStatus,
  saveMfaPhoneAndSend,
  sendMfaSmsCode,
  verifyMfaSmsCode,
} from '@/app/actions/mfa'
import { safeMfaNext } from '@/lib/auth/mfa'

interface MfaSmsFormProps {
  nextPath: string
  /** Setup flow: collect phone if missing, then verify SMS. */
  mode: 'setup' | 'verify'
}

export function MfaSmsForm({ nextPath, mode }: MfaSmsFormProps) {
  const router = useRouter()
  const destination = safeMfaNext(nextPath, '/')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null)
  const [deliveryChannel, setDeliveryChannel] = useState<'sms' | 'whatsapp'>('sms')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [needsPhone, setNeedsPhone] = useState(mode === 'setup')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  const deliverCode = useCallback(async (send: () => Promise<{ success: boolean; error?: string; data?: { maskedPhone: string; devCode?: string; deliveryChannel?: 'sms' | 'whatsapp' } }>) => {
    setSending(true)
    setError(null)
    const result = await send()
    setSending(false)
    if (!result.success) {
      setError(result.error ?? 'Could not send the code.')
      return false
    }
    if (result.data) {
      setMaskedPhone(result.data.maskedPhone)
      setDeliveryChannel(result.data.deliveryChannel ?? 'sms')
      setDevCode(result.data.devCode ?? null)
    }
    return true
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const status = await getMfaSmsStatus()
        if (cancelled) return

        if (!status.success) {
          setError(status.error)
          setBootstrapping(false)
          return
        }

        const { hasPhone, maskedPhone: masked, sessionVerified } = status.data!

        if (mode === 'verify' && sessionVerified) {
          router.replace(destination)
          return
        }

        if (mode === 'setup' && !hasPhone) {
          setNeedsPhone(true)
          setBootstrapping(false)
          return
        }

        setNeedsPhone(false)
        setMaskedPhone(masked)
        setBootstrapping(false)

        if (mode === 'verify' || hasPhone) {
          if (!sessionVerified) {
            await deliverCode(sendMfaSmsCode)
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

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const ok = await deliverCode(() => saveMfaPhoneAndSend(phone))
    setLoading(false)
    if (ok) setNeedsPhone(false)
  }

  async function handleResend() {
    await deliverCode(sendMfaSmsCode)
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await verifyMfaSmsCode(code, destination)
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

  if (needsPhone) {
    return (
      <form onSubmit={handleSavePhone} className="space-y-5">
        <p className="text-sm text-white/70">
          Add your mobile number. We&apos;ll send a 6-digit code via WhatsApp or SMS to verify it.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-phone" className="text-white/90">
            Phone number
          </Label>
          <Input
            id="mfa-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+233 XX XXX XXXX"
            required
            className="border-white/20 bg-white/10 text-white"
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={loading || sending || !phone.trim()}
          className="h-11 w-full bg-[#3C216C] text-white hover:bg-[#4c2a85] disabled:opacity-60"
        >
          {loading || sending ? 'Sending code…' : 'Send verification code'}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <p className="text-sm text-white/70">
        {maskedPhone
          ? `Enter the 6-digit code we sent to ${maskedPhone} via ${deliveryChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.`
          : `Enter the 6-digit code from your ${deliveryChannel === 'whatsapp' ? 'WhatsApp message' : 'SMS'}.`}
      </p>

      {devCode && (
        <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
          Dev mode: your code is <span className="font-mono font-bold">{devCode}</span> (check the
          terminal if SMS is not configured).
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="mfa-sms-code" className="text-white/90">
          Verification code
        </Label>
        <Input
          id="mfa-sms-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          required
          minLength={6}
          maxLength={6}
          autoFocus
          className="border-white/20 bg-white/10 text-center text-lg tracking-[0.3em] text-white"
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
        className="h-11 w-full bg-[#3C216C] text-white hover:bg-[#4c2a85] disabled:opacity-60"
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

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Smartphone } from 'lucide-react'
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
import type { MfaPhoneChannel } from '@/lib/notifications/mfa-phone-channels'

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
  const [phoneChannels, setPhoneChannels] = useState<MfaPhoneChannel[]>(['sms'])
  const [selectedChannel, setSelectedChannel] = useState<MfaPhoneChannel | null>(null)
  const [deliveryChannel, setDeliveryChannel] = useState<MfaPhoneChannel>('sms')
  const [codeSent, setCodeSent] = useState(false)
  const [devCode, setDevCode] = useState<string | null>(null)
  const [needsPhone, setNeedsPhone] = useState(mode === 'setup')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  const deliverCode = useCallback(
    async (channel: MfaPhoneChannel, send: () => Promise<{ success: boolean; error?: string; data?: { maskedPhone: string; devCode?: string; deliveryChannel?: MfaPhoneChannel } }>) => {
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
        setDeliveryChannel(result.data.deliveryChannel ?? channel)
        setSelectedChannel(result.data.deliveryChannel ?? channel)
        setDevCode(result.data.devCode ?? null)
      }
      setCodeSent(true)
      return true
    },
    [],
  )

  const sendViaChannel = useCallback(
    async (channel: MfaPhoneChannel) => {
      await deliverCode(channel, () => sendMfaSmsCode(channel))
    },
    [deliverCode],
  )

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

        const { hasPhone, maskedPhone: masked, sessionVerified, phoneChannels: channels } =
          status.data!

        setPhoneChannels(channels.length > 0 ? channels : ['sms'])

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

        if ((mode === 'verify' || hasPhone) && !sessionVerified && channels.length === 1) {
          await deliverCode(channels[0]!, () => sendMfaSmsCode(channels[0]))
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
    if (phoneChannels.length > 1) {
      setLoading(true)
      setError(null)
      const result = await saveMfaPhoneAndSend(phone)
      setLoading(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      setNeedsPhone(false)
      setMaskedPhone(result.data?.maskedPhone ?? null)
      return
    }

    setLoading(true)
    const ok = await deliverCode(phoneChannels[0] ?? 'sms', () =>
      saveMfaPhoneAndSend(phone, phoneChannels[0]),
    )
    setLoading(false)
    if (ok) setNeedsPhone(false)
  }

  async function handleChooseChannel(channel: MfaPhoneChannel) {
    setSelectedChannel(channel)
    await sendViaChannel(channel)
  }

  async function handleResend() {
    const channel = selectedChannel ?? deliveryChannel ?? phoneChannels[0] ?? 'sms'
    await sendViaChannel(channel)
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

  const alternateChannel = phoneChannels.find((c) => c !== deliveryChannel)

  if (bootstrapping) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  if (needsPhone) {
    return (
      <form onSubmit={handleSavePhone} className="space-y-5">
        <p className="text-sm text-white/70">
          Add your mobile number. We&apos;ll send a 6-digit code via SMS or WhatsApp to verify it.
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
          {loading || sending ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    )
  }

  if (!codeSent && phoneChannels.length > 1) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-white/70">
          {maskedPhone
            ? `Choose how to receive your 6-digit code at ${maskedPhone}.`
            : 'Choose how to receive your 6-digit verification code.'}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {phoneChannels.includes('sms') && (
            <button
              type="button"
              onClick={() => handleChooseChannel('sms')}
              disabled={sending}
              className="flex flex-col items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
            >
              <Smartphone className="h-5 w-5 text-[#D4A62E]" />
              <span className="font-semibold text-white">SMS</span>
              <span className="text-xs text-white/65">Text message via Arkesel</span>
            </button>
          )}
          {phoneChannels.includes('whatsapp') && (
            <button
              type="button"
              onClick={() => handleChooseChannel('whatsapp')}
              disabled={sending}
              className="flex flex-col items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-60"
            >
              <MessageSquare className="h-5 w-5 text-[#D4A62E]" />
              <span className="font-semibold text-white">WhatsApp</span>
              <span className="text-xs text-white/65">Message via Termii</span>
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        )}

        {sending && <p className="text-sm text-white/70">Sending code…</p>}
      </div>
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
          terminal if messages are not configured).
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

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleResend}
          disabled={sending || loading}
          className="w-full text-center text-xs font-semibold text-[#D4A62E] hover:underline disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Resend code'}
        </button>
        {alternateChannel && (
          <button
            type="button"
            onClick={() => handleChooseChannel(alternateChannel)}
            disabled={sending || loading}
            className="w-full text-center text-xs font-semibold text-white/70 hover:text-white hover:underline disabled:opacity-50"
          >
            {sending
              ? 'Sending…'
              : `Send via ${alternateChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'} instead`}
          </button>
        )}
      </div>
    </form>
  )
}

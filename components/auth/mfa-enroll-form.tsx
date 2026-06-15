'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { safeMfaNext } from '@/lib/auth/mfa'

const PENDING_ENROLL_KEY = 'mojo_mfa_pending_enroll'

interface PendingEnroll {
  factorId: string
  qrCode: string
  secret: string
}

function readPendingEnroll(): PendingEnroll | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ENROLL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingEnroll
  } catch {
    return null
  }
}

function writePendingEnroll(data: PendingEnroll) {
  sessionStorage.setItem(PENDING_ENROLL_KEY, JSON.stringify(data))
}

function clearPendingEnroll() {
  sessionStorage.removeItem(PENDING_ENROLL_KEY)
}

interface MfaEnrollFormProps {
  nextPath: string
  required?: boolean
}

export function MfaEnrollForm({ nextPath, required = false }: MfaEnrollFormProps) {
  const router = useRouter()
  const bootstrapStarted = useRef(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  const destination = safeMfaNext(nextPath, '/')

  const startEnrollment = useCallback(async (forceNew: boolean) => {
    setError(null)
    setBootstrapping(true)
    setCode('')

    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const verified = (factors?.totp ?? []).find((f) => f.status === 'verified')
    if (verified) {
      clearPendingEnroll()
      router.replace(destination)
      return
    }

    if (!forceNew) {
      const pending = readPendingEnroll()
      const unverified = (factors?.totp ?? []).find((f) => f.status !== 'verified')
      if (pending && unverified && pending.factorId === unverified.id) {
        setFactorId(pending.factorId)
        setQrCode(pending.qrCode)
        setSecret(pending.secret)
        setBootstrapping(false)
        return
      }
    }

    for (const factor of factors?.totp ?? []) {
      if (factor.status !== 'verified') {
        await supabase.auth.mfa.unenroll({ factorId: factor.id })
      }
    }
    clearPendingEnroll()

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator app',
    })

    if (enrollError || !data) {
      setError(enrollError?.message ?? 'Could not start MFA enrollment.')
      setBootstrapping(false)
      return
    }

    const pending: PendingEnroll = {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    }
    writePendingEnroll(pending)
    setFactorId(pending.factorId)
    setQrCode(pending.qrCode)
    setSecret(pending.secret)
    setBootstrapping(false)
  }, [destination, router])

  useEffect(() => {
    if (bootstrapStarted.current) return
    bootstrapStarted.current = true
    startEnrollment(false)
  }, [startEnrollment])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })

    if (challengeError || !challenge) {
      setLoading(false)
      setError(challengeError?.message ?? 'Could not start verification. Try again.')
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })

    setLoading(false)

    if (verifyError) {
      setError(
        verifyError.message.includes('Invalid')
          ? 'Invalid code. Wait for a fresh code in your app (codes change every 30s), check your device clock is correct, then try again.'
          : verifyError.message,
      )
      return
    }

    clearPendingEnroll()
    router.push(destination)
    router.refresh()
  }

  if (bootstrapping) {
    return <p className="text-sm text-white/70">Preparing your authenticator setup…</p>
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/70">
        {required
          ? 'Two-factor authentication is required for your role. Scan the QR code with Google Authenticator, Authy, or 1Password.'
          : 'Add an extra layer of security. Scan the QR code with your authenticator app.'}
      </p>

      {qrCode && (
        // Supabase returns a data-URL SVG — use <img>, not raw HTML injection.
        <img
          src={qrCode}
          alt="Scan this QR code with your authenticator app"
          className="mx-auto block w-48 rounded-xl bg-white p-4"
        />
      )}

      {secret && (
        <div className="rounded-lg bg-white/10 px-3 py-2 text-center">
          <p className="text-xs text-white/50">Can&apos;t scan? Enter this secret manually:</p>
          <p className="mt-1 break-all font-mono text-sm text-white">{secret}</p>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mfa-code" className="text-white/90">
            6-digit code
          </Label>
          <Input
            id="mfa-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            required
            minLength={6}
            maxLength={6}
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
          {loading ? 'Verifying…' : 'Enable two-factor authentication'}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => startEnrollment(true)}
        disabled={loading || bootstrapping}
        className="w-full text-center text-xs font-semibold text-white/50 hover:text-white/80 disabled:opacity-50"
      >
        Generate a new QR code
      </button>
    </div>
  )
}

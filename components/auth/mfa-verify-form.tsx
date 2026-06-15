'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { safeMfaNext } from '@/lib/auth/mfa'

interface MfaVerifyFormProps {
  nextPath: string
}

export function MfaVerifyForm({ nextPath }: MfaVerifyFormProps) {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  const destination = safeMfaNext(nextPath, '/')

  useEffect(() => {
    let cancelled = false

    async function loadFactor() {
      const supabase = createClient()
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const verified = (factors?.totp ?? []).find((f) => f.status === 'verified')

      if (cancelled) return

      if (!verified) {
        router.replace(`/enroll-mfa?next=${encodeURIComponent(destination)}`)
        return
      }

      setFactorId(verified.id)
      setBootstrapping(false)
    }

    loadFactor()
  }, [destination, router])

  async function handleSubmit(e: React.FormEvent) {
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
      setError(challengeError?.message ?? 'Could not verify the code. Try again.')
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })

    setLoading(false)

    if (verifyError) {
      setError('Invalid code. Check your authenticator app and try again.')
      return
    }

    router.push(destination)
    router.refresh()
  }

  if (bootstrapping) {
    return <p className="text-sm text-white/70">Loading…</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-white/70">
        Enter the 6-digit code from your authenticator app to continue.
      </p>

      <div className="space-y-2">
        <Label htmlFor="mfa-verify-code" className="text-white/90">
          Authentication code
        </Label>
        <Input
          id="mfa-verify-code"
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
    </form>
  )
}

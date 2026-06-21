'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { verifyMfaTotpCode } from '@/app/actions/mfa'
import { safeMfaNext } from '@/lib/auth/mfa'

interface MfaTotpFormProps {
  nextPath: string
}

export function MfaTotpForm({ nextPath }: MfaTotpFormProps) {
  const router = useRouter()
  const destination = safeMfaNext(nextPath, '/')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await verifyMfaTotpCode(code, destination)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    router.push(result.data?.redirectTo ?? destination)
    router.refresh()
  }

  return (
    <form onSubmit={handleVerify} className="space-y-5">
      <p className="text-sm text-white/70">
        Open your authenticator app and enter the 6-digit code for MOJO Apartments.
      </p>

      <div className="space-y-2">
        <Label htmlFor="mfa-totp-code" className="text-white/90">
          Verification code
        </Label>
        <Input
          id="mfa-totp-code"
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

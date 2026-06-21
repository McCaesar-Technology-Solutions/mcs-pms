'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { beginTotpSetup, confirmTotpSetup, verifyMfaTotpCode } from '@/app/actions/mfa'
import { safeMfaNext } from '@/lib/auth/mfa'

interface MfaTotpSetupPanelProps {
  nextPath?: string
  variant?: 'auth' | 'settings'
  onComplete?: () => void
  onCancel?: () => void
}

export function MfaTotpSetupPanel({
  nextPath = '/',
  variant = 'settings',
  onComplete,
  onCancel,
}: MfaTotpSetupPanelProps) {
  const router = useRouter()
  const destination = safeMfaNext(nextPath, '/')
  const isAuth = variant === 'auth'

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [manualSecret, setManualSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(true)

  const loadSetup = useCallback(async () => {
    setBootstrapping(true)
    setError(null)
    const result = await beginTotpSetup()
    setBootstrapping(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    if (!result.data) {
      setError('Could not start authenticator setup.')
      return
    }
    setQrDataUrl(result.data.qrDataUrl)
    setManualSecret(result.data.manualSecret)
  }, [])

  useEffect(() => {
    void loadSetup()
  }, [loadSetup])

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const confirm = await confirmTotpSetup(code)
    if (!confirm.success) {
      setLoading(false)
      setError(confirm.error)
      return
    }

    if (isAuth) {
      const verified = await verifyMfaTotpCode(code, destination)
      setLoading(false)
      if (!verified.success) {
        setError(verified.error)
        return
      }
      router.push(verified.data?.redirectTo ?? destination)
      router.refresh()
      return
    }

    setLoading(false)
    onComplete?.()
    router.refresh()
  }

  const labelClass = isAuth ? 'text-white/90' : 'text-foreground'
  const hintClass = isAuth ? 'text-white/70' : 'text-muted-foreground'
  const inputClass = isAuth
    ? 'border-white/20 bg-white/10 text-center text-lg tracking-[0.3em] text-white'
    : 'input-soft text-center text-lg tracking-[0.3em]'

  if (bootstrapping) {
    return <p className={`text-sm ${hintClass}`}>Preparing QR code…</p>
  }

  if (!qrDataUrl) {
    return (
      <div className="space-y-3">
        <p className={`text-sm text-red-600 ${isAuth ? 'text-red-200' : ''}`}>{error}</p>
        <button type="button" onClick={() => loadSetup()} className="text-sm font-semibold text-primary">
          Try again
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleConfirm} className="space-y-5">
      <p className={`text-sm ${hintClass}`}>
        Scan this QR code with Google Authenticator, Authy, or another TOTP app, then enter the
        6-digit code to confirm.
      </p>

      <div className="flex justify-center">
        <img src={qrDataUrl} alt="Authenticator QR code" className="rounded-xl bg-white p-2" />
      </div>

      {manualSecret && (
        <p className={`text-xs ${hintClass}`}>
          Manual key: <span className="font-mono font-semibold">{manualSecret}</span>
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="totp-setup-code" className={labelClass}>
          Verification code
        </Label>
        <Input
          id="totp-setup-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          required
          minLength={6}
          maxLength={6}
          className={inputClass}
        />
      </div>

      {error && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${isAuth ? 'bg-red-500/20 text-red-200' : 'bg-red-50 text-red-700'}`}
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={loading || code.length !== 6}
          className={
            isAuth
              ? 'h-11 flex-1 bg-[#3C216C] text-white hover:bg-[#4c2a85]'
              : 'flex-1 rounded-xl bg-primary text-primary-foreground'
          }
        >
          {loading ? 'Confirming…' : 'Confirm authenticator'}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'
import { acceptInvite } from '@/app/actions/auth'

function AcceptInviteForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? searchParams.get('t') ?? ''

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!token) {
    return (
      <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
        Missing invite token. Check the invite link you received.
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await acceptInvite(token, name, password, confirmPassword, phone)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    window.location.assign(result.redirectTo)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-white/90">
          Full name
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="auth-field"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="text-white/90">
          Phone number
        </Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="+233 XX XXX XXXX"
          className="auth-field"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/90">
          Password
        </Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={PASSWORD_MIN_LENGTH}
          className="auth-field"
        />
        <p className="text-xs text-white/55">At least {PASSWORD_MIN_LENGTH} characters.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-white/90">
          Confirm password
        </Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={PASSWORD_MIN_LENGTH}
          className="auth-field"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="auth-submit-btn">
        {loading ? 'Creating account…' : 'Accept invite'}
      </button>
    </form>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="auth-form-card">
      <div className="mb-8 text-center">
        <p className="auth-brand-title">MOJO APARTMENTS</p>
        <p className="mt-2 text-sm text-white/75">Complete your staff registration</p>
      </div>
      <Suspense fallback={<p className="text-white/75">Loading…</p>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  )
}

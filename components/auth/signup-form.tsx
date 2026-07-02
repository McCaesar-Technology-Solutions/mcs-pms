'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { signUpOwner } from '@/app/actions/auth'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'

export function SignUpForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await signUpOwner({ name, email, password, confirmPassword })
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    window.location.assign(result.redirectTo)
  }

  return (
    <div className="auth-form-card">
      <div className="mb-8 text-center">
        <Link href="/login" className="auth-brand-title hover:text-[var(--brand-gold-light)]">
          MOJO APARTMENTS
        </Link>
        <p className="mt-2 text-sm text-white/75">Create your owner account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-white/90">
            Your name
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
          <Label htmlFor="email" className="text-white/90">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
          {loading ? 'Creating account…' : 'Continue to setup'}
        </button>

        <p className="text-center text-xs text-white/55">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="text-[var(--brand-gold)] hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-[var(--brand-gold)] hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-white/75">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[var(--brand-gold)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset } from '@/app/actions/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await requestPasswordReset(email)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }
    setSent(true)
  }

  return (
    <div className="auth-form-card">
      <div className="mb-8 text-center">
        <p className="auth-brand-title">MOJO APARTMENTS</p>
        <p className="mt-2 text-sm text-white/75">Reset your password</p>
      </div>

      {sent ? (
        <div className="space-y-5">
          <p className="rounded-lg bg-emerald-500/15 px-3 py-3 text-sm text-emerald-100">
            If an account exists for <span className="font-semibold">{email}</span>, we&apos;ve sent
            a reset link. Check your inbox (and spam folder).
          </p>
          <Link
            href="/login"
            className="block text-center text-sm font-semibold text-[var(--brand-gold)] hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="name@example.com"
              className="auth-field"
            />
            <p className="text-xs text-white/55">
              We&apos;ll email a link to set a new password. Technicians who sign in by phone should
              ask an owner or manager for help.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="auth-submit-btn">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>

          <Link
            href="/login"
            className="block text-center text-sm font-semibold text-[var(--brand-gold)] hover:underline"
          >
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { signIn } from '@/app/actions/auth'
import { isMfaPath } from '@/lib/auth/mfa'

const BLOCKED_LOGIN_NEXT = ['/login', '/signup', '/accept-invite']

function isBlockedLoginNext(next: string): boolean {
  const pathOnly = next.split('?')[0] ?? next
  if (isMfaPath(pathOnly)) return true
  return BLOCKED_LOGIN_NEXT.some((p) => pathOnly === p || pathOnly.startsWith(`${p}/`))
}

interface LoginFormProps {
  publicSignupAllowed: boolean
}

export function LoginForm({ publicSignupAllowed }: LoginFormProps) {
  const searchParams = useSearchParams()
  const resetDone = searchParams.get('reset') === 'success'
  const linkExpired = searchParams.get('error') === 'link_expired'
  const signupDisabled = searchParams.get('error') === 'signup_disabled'
  const nextParam = searchParams.get('next')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn(identifier, password)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    const safeNext =
      nextParam &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !isBlockedLoginNext(nextParam)
        ? nextParam
        : null
    window.location.assign(safeNext ?? result.redirectTo)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--brand-purple-ink)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-white/[0.08] p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold tracking-wide text-[var(--brand-gold)]">
            MOJO APARTMENTS
          </p>
          <p className="mt-2 text-sm text-white/70">Staff sign in</p>
        </div>

        {resetDone && (
          <p className="mb-5 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100">
            Password updated. Sign in with your new password.
          </p>
        )}
        {linkExpired && (
          <p className="mb-5 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
            That reset link has expired. Request a new one below.
          </p>
        )}
        {signupDisabled && (
          <p className="mb-5 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
            Self-service registration is closed. Contact your administrator for access.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="identifier" className="text-white/90">
              Email or phone
            </Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              inputMode="email"
              placeholder="you@hotel.com or +233 24 123 4567"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
            <p className="text-xs text-white/50">
              Technicians: sign in with the phone number from your invite.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white/90">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[var(--brand-gold)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="guest-btn guest-btn-primary h-11 w-full disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {publicSignupAllowed ? (
          <p className="mt-6 text-center text-sm text-white/70">
            New here?{' '}
            <Link href="/signup" className="font-semibold text-[var(--brand-gold)] hover:underline">
              Create an owner account
            </Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-sm text-white/55">
            New owner accounts are by invitation only. Contact your administrator.
          </p>
        )}

        <p className="mt-4 text-center text-xs text-white/45">
          <Link href="/privacy" className="hover:text-[var(--brand-gold)] hover:underline">
            Privacy
          </Link>
          {' · '}
          <Link href="/terms" className="hover:text-[var(--brand-gold)] hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}

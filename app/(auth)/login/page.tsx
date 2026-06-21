'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn } from '@/app/actions/auth'

const BLOCKED_LOGIN_NEXT = ['/login', '/signup', '/enroll-mfa', '/verify-mfa', '/accept-invite']

function LoginForm() {
  const searchParams = useSearchParams()
  const resetDone = searchParams.get('reset') === 'success'
  const linkExpired = searchParams.get('error') === 'link_expired'
  const nextParam = searchParams.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn(email, password)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    const safeNext =
      nextParam &&
      nextParam.startsWith('/') &&
      !nextParam.startsWith('//') &&
      !BLOCKED_LOGIN_NEXT.some((p) => nextParam === p || nextParam.startsWith(`${p}/`))
        ? nextParam
        : null
    window.location.assign(safeNext ?? result.redirectTo)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p
            className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold tracking-wide text-[#D4A62E]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
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
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white/90">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[#D4A62E] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
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
            className="h-11 w-full bg-[#3C216C] text-white hover:bg-[#4c2a85] disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/70">
          New here?{' '}
          <Link href="/signup" className="font-semibold text-[#D4A62E] hover:underline">
            Create an owner account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12" />
      }
    >
      <LoginForm />
    </Suspense>
  )
}

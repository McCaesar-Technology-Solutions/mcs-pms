'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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

  const fieldClass = 'border-white/20 bg-white/10 text-white placeholder:text-white/40'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <Link
            href="/login"
            className="text-3xl font-semibold tracking-wide text-[#D4A62E] hover:text-[#e0b64a]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
            MOJO APARTMENTS
          </Link>
          <p className="mt-2 text-sm text-white/70">Create your owner account</p>
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
              className={fieldClass}
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
              className={fieldClass}
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
              className={fieldClass}
            />
            <p className="text-xs text-white/50">At least {PASSWORD_MIN_LENGTH} characters.</p>
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
              className={fieldClass}
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
            {loading ? 'Creating account…' : 'Continue to setup'}
          </Button>

          <p className="text-center text-xs text-white/50">
            By creating an account you agree to our{' '}
            <Link href="/terms" className="text-[#D4A62E] hover:underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-[#D4A62E] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="mt-6 text-center text-sm text-white/70">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#D4A62E] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

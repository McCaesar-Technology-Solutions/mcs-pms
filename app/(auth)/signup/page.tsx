'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signUpOwner } from '@/app/actions/auth'

export default function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signUpOwner({ name, email, password, organizationName })
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    window.location.assign(result.redirectTo)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-3xl font-semibold tracking-wide text-[#D4A62E] hover:text-[#e0b64a]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
            MOJO APARTMENTS
          </Link>
          <p className="mt-2 text-sm text-white/70">Start your 14-day free trial</p>
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
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/90">
              Work email
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
            <Label htmlFor="password" className="text-white/90">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationName" className="text-white/90">
              Business or portfolio name
            </Label>
            <Input
              id="organizationName"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. MOJO Hospitality Group"
              required
              className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
            />
            <p className="text-xs text-white/45">
              You&apos;ll add your first property in the next step.
            </p>
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

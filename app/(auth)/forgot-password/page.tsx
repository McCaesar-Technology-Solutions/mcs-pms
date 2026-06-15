'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p
            className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold tracking-wide text-[#D4A62E]"
            style={{ fontFamily: 'var(--font-cormorant, "Cormorant Garamond", serif)' }}
          >
            MOJO APARTMENTS
          </p>
          <p className="mt-2 text-sm text-white/70">Reset your password</p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <p className="rounded-lg bg-emerald-500/15 px-3 py-3 text-sm text-emerald-100">
              If an account exists for <span className="font-semibold">{email}</span>, we&apos;ve
              sent a reset link. Check your inbox (and spam folder).
            </p>
            <Link
              href="/login"
              className="block text-center text-sm font-semibold text-[#D4A62E] hover:underline"
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
                className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/50">
                We&apos;ll email a link to set a new password. Technicians who sign in by phone
                should ask an owner or manager for help.
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
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>

            <Link
              href="/login"
              className="block text-center text-sm font-semibold text-[#D4A62E] hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}

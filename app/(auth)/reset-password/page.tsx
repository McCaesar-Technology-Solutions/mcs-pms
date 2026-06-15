'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword } from '@/app/actions/auth'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await updatePassword(password, confirm)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }
    setDone(true)
    setTimeout(() => router.push('/login?reset=success'), 1500)
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
          <p className="mt-2 text-sm text-white/70">Choose a new password</p>
        </div>

        {done ? (
          <p className="rounded-lg bg-emerald-500/15 px-3 py-3 text-sm text-emerald-100">
            Password updated. Redirecting you to sign in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="border-white/20 bg-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-white/90">
                Confirm password
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="border-white/20 bg-white/10 text-white"
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
              {loading ? 'Saving…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

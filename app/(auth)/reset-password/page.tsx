'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/auth/password-input'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy'
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

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

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
    <div className="auth-form-card">
      <div className="mb-8 text-center">
        <p className="auth-brand-title">MOJO APARTMENTS</p>
        <p className="mt-2 text-sm text-white/75">Choose a new password</p>
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
            <Label htmlFor="confirm" className="text-white/90">
              Confirm password
            </Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
      )}
    </div>
  )
}

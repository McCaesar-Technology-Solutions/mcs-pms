'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { acceptInvite } from '@/app/actions/auth'

function AcceptInviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
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
    setLoading(true)

    const result = await acceptInvite(token, name, password, phone)
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    router.push(result.redirectTo)
    router.refresh()
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
          className="border-white/20 bg-white/10 text-white"
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
          className="border-white/20 bg-white/10 text-white"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/90">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        className="h-11 w-full bg-[#3C216C] text-white hover:bg-[#4c2a85]"
      >
        {loading ? 'Creating account…' : 'Accept invite'}
      </Button>
    </form>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#22124C] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-8 text-center">
          <p className="text-3xl font-semibold text-[#D4A62E]">MOJO APARTMENTS</p>
          <p className="mt-2 text-sm text-white/70">Complete your staff registration</p>
        </div>
        <Suspense fallback={<p className="text-white/70">Loading…</p>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  )
}

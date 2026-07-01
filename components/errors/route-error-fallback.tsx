'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { captureException } from '@/lib/monitoring/sentry'

interface RouteErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  boundary: string
  homeHref?: string
  homeLabel?: string
}

export function RouteErrorFallback({
  error,
  reset,
  boundary,
  homeHref = '/login',
  homeLabel = 'Sign in',
}: RouteErrorFallbackProps) {
  useEffect(() => {
    console.error(error)
    captureException(error, { digest: error.digest, boundary })
  }, [error, boundary])

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-[var(--brand-purple-ink)] px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 top-0 h-56 w-56 rounded-full bg-[var(--brand-gold)]/10 blur-3xl" />
      </div>
      <div className="relative max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <AlertTriangle className="h-7 w-7 text-[var(--brand-gold)]" strokeWidth={1.75} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-white">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          An unexpected error occurred. Try again, or contact support if the problem continues.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="guest-btn guest-btn-primary px-6 py-3 text-sm"
          >
            Try again
          </button>
          <Link
            href={homeHref}
            className="guest-btn guest-btn-ghost px-6 py-3 text-sm ring-1 ring-white/15"
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}

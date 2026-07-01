'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    captureException(error, { digest: error.digest, boundary: 'app/global-error' })
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-[#22124c] px-6 text-center text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 top-0 h-48 w-48 rounded-full bg-[#d4a62e]/12 blur-3xl" />
        </div>
        <div className="relative max-w-md">
          <p className="font-serif text-4xl font-semibold text-[#d4a62e]">MOJO</p>
          <h1 className="mt-4 text-xl font-semibold">Application error</h1>
          <p className="mt-2 text-sm text-white/70">
            A critical error occurred. Please reload the page or try again later.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-8 rounded-xl bg-[#d4a62e] px-6 py-3 text-sm font-semibold text-[#22124c] transition hover:brightness-105 active:scale-[0.98]"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}

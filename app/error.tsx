'use client'

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    captureException(error, { digest: error.digest, boundary: 'app/error' })
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Try again, or contact support if the problem continues.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-[#3C216C] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  )
}

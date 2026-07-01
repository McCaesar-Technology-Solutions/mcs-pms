'use client'

import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export default function GuestError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <RouteErrorFallback
      error={error}
      reset={reset}
      boundary="guest/error"
      homeHref="/guest"
      homeLabel="Guest portal"
    />
  )
}

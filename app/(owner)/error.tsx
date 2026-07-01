'use client'

import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export default function OwnerError({
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
      boundary="owner/error"
      homeHref="/owner/dashboard"
      homeLabel="Dashboard"
    />
  )
}

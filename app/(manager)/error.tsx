'use client'

import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export default function ManagerError({
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
      boundary="manager/error"
      homeHref="/manager/dashboard"
      homeLabel="Dashboard"
    />
  )
}

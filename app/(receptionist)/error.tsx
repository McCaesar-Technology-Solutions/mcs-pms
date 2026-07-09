'use client'

import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export default function ReceptionistError({
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
      boundary="receptionist/error"
      homeHref="/receptionist/dashboard"
      homeLabel="Dashboard"
    />
  )
}

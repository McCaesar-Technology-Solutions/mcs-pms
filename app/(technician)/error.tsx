'use client'

import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export default function TechnicianError({
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
      boundary="technician/error"
      homeHref="/technician/tasks"
      homeLabel="Tasks"
    />
  )
}

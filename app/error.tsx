'use client'

import { RouteErrorFallback } from '@/components/errors/route-error-fallback'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <RouteErrorFallback error={error} reset={reset} boundary="app/error" />
}

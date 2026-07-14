import * as Sentry from '@sentry/nextjs'
import { getSentryDsn } from '@/lib/monitoring/sentry-init-options'

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!getSentryDsn()) return

  Sentry.captureException(error, context ? { extra: context } : undefined)
}

export { getSentryDsn }

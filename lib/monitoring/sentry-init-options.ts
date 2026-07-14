export function getSentryDsn(): string | undefined {
  return (
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ||
    undefined
  )
}

export function baseSentryOptions() {
  const dsn = getSentryDsn()

  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  }
}

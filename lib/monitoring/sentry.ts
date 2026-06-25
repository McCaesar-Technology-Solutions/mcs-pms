/**
 * Lightweight Sentry reporting when SENTRY_DSN is configured.
 * Avoids bundling @sentry/nextjs while still supporting production error capture.
 */

function parseDsn(dsn: string): { ingestUrl: string; publicKey: string } | null {
  try {
    const url = new URL(dsn)
    const publicKey = url.username
    if (!publicKey) return null
    const projectId = url.pathname.replace(/^\//, '')
    const host = url.host
    return {
      publicKey,
      ingestUrl: `https://${host}/api/${projectId}/store/`,
    }
  } catch {
    return null
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return

  const parsed = parseDsn(dsn)
  if (!parsed) return

  const err = error instanceof Error ? error : new Error(String(error))
  const payload = {
    event_id: globalThis.crypto.randomUUID().replace(/-/g, ''),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    environment: process.env.NODE_ENV ?? 'production',
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split('\n')
                  .slice(1, 20)
                  .map((line) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    extra: context,
  }

  void fetch(parsed.ingestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined)
}

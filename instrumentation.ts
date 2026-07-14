import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NODE_ENV === 'production') {
      const { validateProductionEnv } = await import('@/lib/env')
      const result = validateProductionEnv()
      if (!result.ok) {
        const message = `[startup] Production env validation failed: ${result.errors.join('; ')}`
        console.error(message)
        throw new Error(message)
      }
    }

    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError

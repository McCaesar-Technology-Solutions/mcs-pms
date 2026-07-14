import * as Sentry from '@sentry/nextjs'
import { baseSentryOptions } from '@/lib/monitoring/sentry-init-options'

Sentry.init(baseSentryOptions())

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart

/**
 * Runtime environment validation. Fail fast in production when required secrets are missing.
 */

import { isResendSandboxFrom, resolveEmailFromEnv } from '@/lib/notifications/email-provider'

const isProduction = process.env.NODE_ENV === 'production'

export function isProd(): boolean {
  return isProduction
}

/** Owner self-signup. Disabled by default in production; set DISABLE_PUBLIC_SIGNUP=false to allow. */
export function isPublicSignupAllowed(): boolean {
  if (process.env.DISABLE_PUBLIC_SIGNUP === 'true') return false
  if (isProduction) return process.env.DISABLE_PUBLIC_SIGNUP === 'false'
  return true
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/** Validate core vars — call at startup / health ready check. */
export function validateCoreEnv(): { ok: true } | { ok: false; missing: string[] } {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
  ]
  const missing = required.filter((k) => !process.env[k]?.trim())
  if (missing.length) return { ok: false, missing }
  return { ok: true }
}

/** Stricter validation for production deploys. */
export function validateProductionEnv(): { ok: true } | { ok: false; errors: string[] } {
  const core = validateCoreEnv()
  if (!core.ok) return { ok: false, errors: core.missing.map((m) => `Missing ${m}`) }

  const errors: string[] = []

  if (!process.env.MFA_OTP_SECRET?.trim()) {
    errors.push('Missing MFA_OTP_SECRET (required in production)')
  }
  if (!process.env.GUEST_SESSION_SECRET?.trim()) {
    errors.push('Missing GUEST_SESSION_SECRET (required in production)')
  }
  if (!process.env.CRON_SECRET?.trim()) {
    errors.push('Missing CRON_SECRET (required for scheduled jobs)')
  }

  const smsOk = Boolean(process.env.ARKESEL_API_KEY || process.env.HUBTEL_CLIENT_ID)
  const emailOk = Boolean(process.env.RESEND_API_KEY)
  if (!smsOk && !emailOk) {
    errors.push('Configure at least one notification provider (ARKESEL_API_KEY or RESEND_API_KEY)')
  }

  if (process.env.ARKESEL_API_KEY?.trim() && !process.env.ARKESEL_SENDER_ID?.trim()) {
    errors.push('ARKESEL_SENDER_ID is required when ARKESEL_API_KEY is set')
  }

  if (process.env.RESEND_API_KEY?.trim() && isResendSandboxFrom(resolveEmailFromEnv())) {
    errors.push(
      'RESEND_FROM must use a verified domain (sandbox onboarding@resend.dev is not allowed in production)',
    )
  }

  const notificationChannels = process.env.NOTIFICATION_CHANNELS?.trim().toLowerCase() ?? ''
  const whatsappRequested =
    notificationChannels.includes('whatsapp') || Boolean(process.env.TERMII_API_KEY?.trim())

  if (whatsappRequested) {
    if (!process.env.TERMII_API_KEY?.trim()) {
      errors.push('TERMII_API_KEY is required for WhatsApp notifications')
    }
    if (!process.env.TERMII_WHATSAPP_SENDER?.trim()) {
      errors.push('TERMII_WHATSAPP_SENDER is required for WhatsApp notifications')
    }
    // Soft requirement: MFA WhatsApp OTPs need an approved Auth template outside the 24h window.
    if (!process.env.TERMII_WHATSAPP_TEMPLATE_ID?.trim()) {
      console.warn(
        '[env] TERMII_WHATSAPP_TEMPLATE_ID unset — WhatsApp MFA may fail outside a 24h chat session; use SMS or set an approved Termii Auth template',
      )
    }
  }

  const paymentsEnabled = process.env.PAYMENTS_ENABLED?.trim().toLowerCase() === 'true'
  if (paymentsEnabled && !process.env.PAYSTACK_SECRET_KEY?.trim()) {
    errors.push('PAYSTACK_SECRET_KEY is required when PAYMENTS_ENABLED=true')
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true }
}

export function getGuestSessionSecret(): string {
  const secret = process.env.GUEST_SESSION_SECRET?.trim()
  if (secret) return secret
  if (isProduction) {
    throw new Error('GUEST_SESSION_SECRET is required in production')
  }
  return 'dev-guest-session-secret-change-me'
}

export function getMfaOtpSecret(): string {
  const secret = process.env.MFA_OTP_SECRET?.trim()
  if (secret) return secret
  if (isProduction) {
    throw new Error('MFA_OTP_SECRET is required in production')
  }
  return 'dev-only-mfa-secret-change-me'
}

export function getAppOrigin(): string {
  const raw = requireEnv('NEXT_PUBLIC_APP_URL').trim()
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withProtocol)
    return `${url.protocol}//${url.host}`
  } catch {
    return withProtocol.replace(/\/$/, '')
  }
}

export function getCronSecret(): string {
  if (isProduction) return requireEnv('CRON_SECRET')
  return process.env.CRON_SECRET?.trim() ?? 'dev-cron-secret'
}

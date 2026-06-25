/**
 * Runtime environment validation. Fail fast in production when required secrets are missing.
 */

const isProduction = process.env.NODE_ENV === 'production'

export function isProd(): boolean {
  return isProduction
}

export function isPublicSignupAllowed(): boolean {
  if (!isProduction) return true
  return process.env.ALLOW_PUBLIC_SIGNUP === 'true'
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
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-only-mfa-secret-change-me'
}

export function getAppOrigin(): string {
  return requireEnv('NEXT_PUBLIC_APP_URL').replace(/\/$/, '')
}

export function getCronSecret(): string {
  if (isProduction) return requireEnv('CRON_SECRET')
  return process.env.CRON_SECRET?.trim() ?? 'dev-cron-secret'
}

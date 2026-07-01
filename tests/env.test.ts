import { describe, expect, it } from 'vitest'
import { validateCoreEnv, validateProductionEnv } from '@/lib/env'

describe('validateCoreEnv', () => {
  it('reports missing required vars', () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const result = validateCoreEnv()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
  })
})

describe('validateProductionEnv', () => {
  it('requires production secrets when core is set', () => {
    const snapshot = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      MFA_OTP_SECRET: process.env.MFA_OTP_SECRET,
      GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
      ARKESEL_API_KEY: process.env.ARKESEL_API_KEY,
      ARKESEL_SENDER_ID: process.env.ARKESEL_SENDER_ID,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM: process.env.RESEND_FROM,
      TERMII_API_KEY: process.env.TERMII_API_KEY,
      TERMII_WHATSAPP_SENDER: process.env.TERMII_WHATSAPP_SENDER,
      NOTIFICATION_CHANNELS: process.env.NOTIFICATION_CHANNELS,
    }

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    delete process.env.MFA_OTP_SECRET
    delete process.env.GUEST_SESSION_SECRET
    delete process.env.CRON_SECRET
    delete process.env.ARKESEL_API_KEY
    delete process.env.ARKESEL_SENDER_ID
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
    delete process.env.TERMII_API_KEY
    delete process.env.TERMII_WHATSAPP_SENDER
    delete process.env.NOTIFICATION_CHANNELS

    const result = validateProductionEnv()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('MFA_OTP_SECRET'))).toBe(true)
    }

    Object.assign(process.env, snapshot)
  })

  it('rejects Resend sandbox sender in production', () => {
    const snapshot = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      MFA_OTP_SECRET: process.env.MFA_OTP_SECRET,
      GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
      ARKESEL_API_KEY: process.env.ARKESEL_API_KEY,
      ARKESEL_SENDER_ID: process.env.ARKESEL_SENDER_ID,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM: process.env.RESEND_FROM,
      TERMII_API_KEY: process.env.TERMII_API_KEY,
      TERMII_WHATSAPP_SENDER: process.env.TERMII_WHATSAPP_SENDER,
      NOTIFICATION_CHANNELS: process.env.NOTIFICATION_CHANNELS,
    }

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    process.env.MFA_OTP_SECRET = 'mfa-secret'
    process.env.GUEST_SESSION_SECRET = 'guest-secret'
    process.env.CRON_SECRET = 'cron-secret'
    process.env.ARKESEL_API_KEY = 'arkesel'
    process.env.ARKESEL_SENDER_ID = 'MOJO'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM = 'MOJO <onboarding@resend.dev>'
    process.env.TERMII_API_KEY = 'termii'
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
    process.env.NOTIFICATION_CHANNELS = 'sms,whatsapp'

    const result = validateProductionEnv()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('RESEND_FROM'))).toBe(true)
    }

    Object.assign(process.env, snapshot)
  })

  it('requires Termii WhatsApp sender when WhatsApp is enabled', () => {
    const snapshot = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      MFA_OTP_SECRET: process.env.MFA_OTP_SECRET,
      GUEST_SESSION_SECRET: process.env.GUEST_SESSION_SECRET,
      CRON_SECRET: process.env.CRON_SECRET,
      ARKESEL_API_KEY: process.env.ARKESEL_API_KEY,
      ARKESEL_SENDER_ID: process.env.ARKESEL_SENDER_ID,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM: process.env.RESEND_FROM,
      TERMII_API_KEY: process.env.TERMII_API_KEY,
      TERMII_WHATSAPP_SENDER: process.env.TERMII_WHATSAPP_SENDER,
      NOTIFICATION_CHANNELS: process.env.NOTIFICATION_CHANNELS,
    }

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    process.env.MFA_OTP_SECRET = 'mfa-secret'
    process.env.GUEST_SESSION_SECRET = 'guest-secret'
    process.env.CRON_SECRET = 'cron-secret'
    process.env.ARKESEL_API_KEY = 'arkesel'
    process.env.ARKESEL_SENDER_ID = 'MOJO'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM = 'MOJO <alerts@example.com>'
    process.env.TERMII_API_KEY = 'termii'
    delete process.env.TERMII_WHATSAPP_SENDER
    process.env.NOTIFICATION_CHANNELS = 'sms,whatsapp'

    const result = validateProductionEnv()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('TERMII_WHATSAPP_SENDER'))).toBe(true)
    }

    Object.assign(process.env, snapshot)
  })
})

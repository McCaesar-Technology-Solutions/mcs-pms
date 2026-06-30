import { describe, expect, it, afterEach } from 'vitest'
import {
  EMAIL_STAFF_TEMPLATE_KEYS,
  defaultNotificationEmailPrefs,
  isEmailTemplateEnabled,
  mergeEmailPrefs,
} from '@/lib/notifications/email-preferences'
import {
  formatEmailFrom,
  isEmailConfigured,
  isResendSandboxFrom,
  normalizeEmailFromHeader,
} from '@/lib/notifications/email-provider'
import { renderStaffEmail } from '@/lib/notifications/email-template'

describe('email notification preferences', () => {
  it('defaults all staff email templates to enabled', () => {
    const prefs = defaultNotificationEmailPrefs()
    for (const key of EMAIL_STAFF_TEMPLATE_KEYS) {
      expect(prefs[key]).toBe(true)
    }
  })

  it('merges stored email overrides', () => {
    const merged = mergeEmailPrefs({ complaint_submitted: false })
    expect(merged.complaint_submitted).toBe(false)
    expect(merged.reservation_new_manager).toBe(true)
  })

  it('respects explicit false for email templates', () => {
    const merged = mergeEmailPrefs({ complaint_submitted: false })
    expect(isEmailTemplateEnabled(merged, 'complaint_submitted')).toBe(false)
  })

  it('always allows staff invite emails', () => {
    const merged = mergeEmailPrefs({ staff_invite: false })
    expect(isEmailTemplateEnabled(merged, 'staff_invite')).toBe(true)
  })
})

describe('email provider formatting', () => {
  it('formats from header with property name', () => {
    expect(formatEmailFrom('MOJO Osu', 'alerts@mojo.com')).toBe(
      'MOJO Osu <alerts@mojo.com>',
    )
  })

  it('normalizes stray spaces in RESEND_FROM', () => {
    expect(normalizeEmailFromHeader('MOJO Apartments <onboarding@resend.dev >')).toBe(
      'MOJO Apartments <onboarding@resend.dev>',
    )
  })

  it('detects Resend sandbox sender', () => {
    expect(isResendSandboxFrom('MOJO Apartments <onboarding@resend.dev>')).toBe(true)
    expect(isResendSandboxFrom('MOJO <alerts@mojo.com>')).toBe(false)
  })
})

describe('email template rendering', () => {
  it('builds html and plain text with action link', () => {
    const { html, text } = renderStaffEmail({
      subject: 'New booking',
      preview: 'A reservation was created.',
      lines: ['Guest: Ada', 'Room 12'],
      actionUrl: 'https://app.example.com/reservations',
      actionLabel: 'View reservations',
    })
    expect(html).toContain('New booking')
    expect(html).toContain('https://app.example.com/reservations')
    expect(text).toContain('View reservations: https://app.example.com/reservations')
  })
})

describe('email provider config', () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it('detects when Resend is configured', async () => {
    delete process.env.RESEND_API_KEY
    expect(isEmailConfigured()).toBe(false)
    process.env.RESEND_API_KEY = 're_test'
    expect(isEmailConfigured()).toBe(true)
  })
})

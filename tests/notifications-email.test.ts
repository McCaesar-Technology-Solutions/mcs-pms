import { describe, expect, it, afterEach } from 'vitest'
import {
  EMAIL_STAFF_TEMPLATE_KEYS,
  defaultNotificationEmailPrefs,
  isEmailTemplateEnabled,
  mergeEmailPrefs,
} from '@/lib/notifications/email-preferences'
import { renderStaffEmail } from '@/lib/notifications/email-template'
import { isEmailConfigured } from '@/lib/notifications/email-provider'

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
    const merged = mergeEmailPrefs({ staff_invite: false })
    expect(isEmailTemplateEnabled(merged, 'staff_invite')).toBe(false)
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

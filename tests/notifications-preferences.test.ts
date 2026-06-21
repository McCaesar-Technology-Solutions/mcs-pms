import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_TEMPLATE_KEYS,
  defaultNotificationSmsPrefs,
  isTemplateEnabled,
  mergeNotificationPrefs,
} from '@/lib/notifications/preferences'

describe('notification preferences', () => {
  it('defaults all templates to enabled', () => {
    const prefs = defaultNotificationSmsPrefs()
    for (const key of NOTIFICATION_TEMPLATE_KEYS) {
      expect(prefs[key]).toBe(true)
    }
  })

  it('merges stored overrides without dropping unknown keys safely', () => {
    const merged = mergeNotificationPrefs({
      reservation_cancelled: false,
      staff_invite: false,
    })
    expect(merged.reservation_cancelled).toBe(false)
    expect(merged.staff_invite).toBe(false)
    expect(merged.reservation_confirmed).toBe(true)
  })

  it('treats missing keys as enabled', () => {
    const merged = mergeNotificationPrefs({})
    expect(isTemplateEnabled(merged, 'complaint_submitted')).toBe(true)
  })

  it('respects explicit false', () => {
    const merged = mergeNotificationPrefs({ guest_checked_in: false })
    expect(isTemplateEnabled(merged, 'guest_checked_in')).toBe(false)
  })

  it('always allows security templates', () => {
    const merged = mergeNotificationPrefs({})
    expect(isTemplateEnabled(merged, 'mfa_otp')).toBe(true)
  })

  it('allows unknown template keys (forward compatible)', () => {
    const merged = mergeNotificationPrefs({})
    expect(isTemplateEnabled(merged, 'future_template')).toBe(true)
  })
})

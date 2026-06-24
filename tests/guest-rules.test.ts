import { describe, expect, it } from 'vitest'
import { DEFAULT_GUEST_RULES } from '@/lib/data/guest-rules'
import { hasAcceptedPropertyRules } from '@/lib/guest-rules-cookie'

describe('DEFAULT_GUEST_RULES', () => {
  it('includes a practical set of hotel house rules', () => {
    expect(DEFAULT_GUEST_RULES.length).toBeGreaterThanOrEqual(5)
    expect(DEFAULT_GUEST_RULES.some((r) => /quiet hours/i.test(r))).toBe(true)
    expect(DEFAULT_GUEST_RULES.some((r) => /smoking/i.test(r))).toBe(true)
  })
})

describe('hasAcceptedPropertyRules', () => {
  it('is exported for server-side cookie checks', () => {
    expect(typeof hasAcceptedPropertyRules).toBe('function')
  })
})

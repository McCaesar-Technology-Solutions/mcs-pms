import { describe, expect, it } from 'vitest'
import { requiresOnboarding, onboardingProgress } from '@/lib/onboarding/state'

describe('requiresOnboarding', () => {
  it('requires setup for owners who have not finished the wizard', () => {
    expect(
      requiresOnboarding({ role: 'owner', onboarding_completed_at: null }),
    ).toBe(true)
    expect(
      requiresOnboarding({
        role: 'owner',
        onboarding_completed_at: null,
      }),
    ).toBe(true)
  })

  it('skips setup once onboarding is completed', () => {
    expect(
      requiresOnboarding({
        role: 'owner',
        onboarding_completed_at: '2026-01-01T00:00:00Z',
      }),
    ).toBe(false)
  })

  it('does not apply to staff roles', () => {
    expect(requiresOnboarding({ role: 'manager', hotel_id: null })).toBe(false)
  })
})

describe('onboardingProgress', () => {
  it('tracks wizard completion', () => {
    expect(onboardingProgress('welcome')).toBe(20)
    expect(onboardingProgress('done')).toBe(100)
  })
})

import { describe, expect, it } from 'vitest'
import {
  ONBOARDING_STEPS,
  onboardingProgress,
  requiresOnboarding,
} from '@/lib/saas/onboarding'
import { daysUntil, isTrialActive, PLAN_CATALOG } from '@/lib/saas/plans'
import { slugifyOrganizationName } from '@/lib/saas/organization'

describe('requiresOnboarding', () => {
  it('requires setup for new owners only', () => {
    expect(requiresOnboarding({ role: 'owner', onboarding_completed_at: null })).toBe(true)
    expect(
      requiresOnboarding({ role: 'owner', onboarding_completed_at: '2026-01-01T00:00:00Z' }),
    ).toBe(false)
    expect(requiresOnboarding({ role: 'manager', onboarding_completed_at: null })).toBe(false)
  })
})

describe('onboardingProgress', () => {
  it('tracks step completion percentage', () => {
    expect(onboardingProgress('welcome')).toBe(20)
    expect(onboardingProgress('property')).toBe(40)
    expect(onboardingProgress('done')).toBe(100)
    expect(ONBOARDING_STEPS).toHaveLength(5)
  })
})

describe('PLAN_CATALOG', () => {
  it('defines trial limits', () => {
    expect(PLAN_CATALOG.trial.maxProperties).toBe(2)
    expect(PLAN_CATALOG.trial.maxRoomsPerProperty).toBe(30)
    expect(PLAN_CATALOG.trial.trialDays).toBe(14)
  })
})

describe('daysUntil', () => {
  it('returns null for missing dates', () => {
    expect(daysUntil(null)).toBeNull()
  })
})

describe('isTrialActive', () => {
  it('detects active trialing status', () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString()
    expect(isTrialActive({ status: 'trialing', trialEndsAt: future })).toBe(true)
    expect(isTrialActive({ status: 'active', trialEndsAt: future })).toBe(false)
  })
})

describe('slugifyOrganizationName', () => {
  it('creates URL-safe slugs', () => {
    expect(slugifyOrganizationName('MOJO Hospitality!')).toBe('mojo-hospitality')
    expect(slugifyOrganizationName('   ')).toBe('portfolio')
  })
})

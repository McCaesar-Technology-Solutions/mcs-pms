import type { OnboardingStep, Profile } from '@/types'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'property',
  'compliance',
  'team',
  'done',
]

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  property: 'Property',
  compliance: 'Compliance',
  team: 'Team',
  done: 'Launch',
}

export function requiresOnboarding(profile: Pick<Profile, 'role' | 'onboarding_completed_at'>): boolean {
  return profile.role === 'owner' && !profile.onboarding_completed_at
}

export function onboardingProgress(step: OnboardingStep): number {
  const index = ONBOARDING_STEPS.indexOf(step)
  if (index < 0) return 0
  return Math.round(((index + 1) / ONBOARDING_STEPS.length) * 100)
}

export function nextOnboardingStep(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEPS.indexOf(step)
  if (index < 0 || index >= ONBOARDING_STEPS.length - 1) return 'done'
  return ONBOARDING_STEPS[index + 1]
}

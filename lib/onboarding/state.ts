import type { Profile } from '@/types'

export type OnboardingStep = 'welcome' | 'property' | 'compliance' | 'team' | 'done'

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

/** Owners need setup until they finish the wizard. */
export function requiresOnboarding(
  profile: Pick<Profile, 'role'> & {
    onboarding_completed_at?: string | null
  },
): boolean {
  if (profile.role !== 'owner') return false
  return !profile.onboarding_completed_at
}

export function onboardingProgress(step: OnboardingStep): number {
  const index = ONBOARDING_STEPS.indexOf(step)
  if (index < 0) return 0
  return Math.round(((index + 1) / ONBOARDING_STEPS.length) * 100)
}

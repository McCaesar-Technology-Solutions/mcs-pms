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

export function onboardingStepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step)
}

/** Allow navigating to any step at or before the current progress. */
export function canNavigateToOnboardingStep(current: OnboardingStep, target: OnboardingStep): boolean {
  const currentIndex = onboardingStepIndex(current)
  const targetIndex = onboardingStepIndex(target)
  return targetIndex >= 0 && targetIndex <= currentIndex
}

/** After saving an edited step, restore furthest progress when the user went back. */
export function resolveOnboardingStepAfterComplete(
  completed: OnboardingStep,
  resume?: OnboardingStep | null,
): OnboardingStep {
  const completedIndex = onboardingStepIndex(completed)
  const sequentialNext = ONBOARDING_STEPS[completedIndex + 1] ?? 'done'
  if (!resume) return sequentialNext

  const nextIndex = onboardingStepIndex(sequentialNext)
  const resumeIndex = onboardingStepIndex(resume)
  if (resumeIndex < nextIndex) return sequentialNext
  return resume
}

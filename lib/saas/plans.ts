export type SaasPlan = 'trial' | 'starter' | 'growth' | 'enterprise'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled'

export type OnboardingStep = 'welcome' | 'property' | 'compliance' | 'team' | 'done'

export interface PlanLimits {
  label: string
  maxProperties: number
  maxRoomsPerProperty: number
  trialDays: number
  description: string
}

export const PLAN_CATALOG: Record<SaasPlan, PlanLimits> = {
  trial: {
    label: 'Free trial',
    maxProperties: 2,
    maxRoomsPerProperty: 30,
    trialDays: 14,
    description: 'Full access for 14 days — up to 2 properties, 30 rooms each.',
  },
  starter: {
    label: 'Starter',
    maxProperties: 1,
    maxRoomsPerProperty: 15,
    trialDays: 0,
    description: 'Single property, up to 15 rooms.',
  },
  growth: {
    label: 'Growth',
    maxProperties: 5,
    maxRoomsPerProperty: 50,
    trialDays: 0,
    description: 'Up to 5 properties, 50 rooms each.',
  },
  enterprise: {
    label: 'Enterprise',
    maxProperties: 99,
    maxRoomsPerProperty: 200,
    trialDays: 0,
    description: 'Portfolio scale with priority support.',
  },
}

export interface SubscriptionSnapshot {
  organizationId: string
  organizationName: string
  plan: SaasPlan
  status: SubscriptionStatus
  trialEndsAt: string | null
  maxProperties: number
  maxRoomsPerProperty: number
  daysLeftInTrial: number | null
  isTrialExpired: boolean
}

export function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null
  const end = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.ceil((end - now) / (24 * 60 * 60 * 1000))
}

export function isTrialActive(sub: Pick<SubscriptionSnapshot, 'status' | 'trialEndsAt'>): boolean {
  if (sub.status !== 'trialing') return false
  if (!sub.trialEndsAt) return true
  return new Date(sub.trialEndsAt).getTime() > Date.now()
}

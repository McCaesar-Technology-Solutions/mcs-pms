import { describe, expect, it } from 'vitest'
import {
  buildGuestRepairSteps,
  guestComplaintReference,
  guestEventLabel,
  isGuestVisibleEvent,
} from '@/lib/complaints/guest-progress'
import type { Complaint } from '@/types'

function complaint(overrides: Partial<Complaint>): Complaint {
  return {
    id: 'abc12345-0000-4000-8000-000000000001',
    status: 'open',
    approval_stage: null,
    guest_id: 'guest-1',
    assigned_to: null,
    scheduled_visit_at: null,
    guest_completion_approved_at: null,
    ...overrides,
  } as Complaint
}

describe('guestComplaintReference', () => {
  it('uses first 8 chars uppercase', () => {
    expect(guestComplaintReference('abc12345-0000-4000-8000-000000000001')).toBe('ABC12345')
  })
})

describe('buildGuestRepairSteps', () => {
  it('marks only received complete for new open complaints', () => {
    const steps = buildGuestRepairSteps(complaint({ status: 'open' }))
    expect(steps[0]?.state).toBe('complete')
    expect(steps[1]?.state).toBe('current')
    expect(steps.find((s) => s.id === 'resolved')?.state).toBe('upcoming')
  })

  it('shows visit step as current when assigned without visit', () => {
    const steps = buildGuestRepairSteps(
      complaint({ status: 'assigned', assigned_to: 'tech-1' }),
    )
    const visit = steps.find((s) => s.id === 'visit')
    expect(visit?.state).toBe('current')
    expect(visit?.detail).toMatch(/call you/i)
  })

  it('includes sign-off step for guest-linked complaints', () => {
    const steps = buildGuestRepairSteps(
      complaint({ status: 'pending_approval', approval_stage: 'completion' }),
    )
    const signoff = steps.find((s) => s.id === 'signoff')
    expect(signoff?.state).toBe('current')
  })

  it('marks all steps complete when resolved', () => {
    const steps = buildGuestRepairSteps(complaint({ status: 'resolved' }))
    expect(steps.every((s) => s.state === 'complete')).toBe(true)
  })
})

describe('guest event visibility', () => {
  it('hides estimate events from guests', () => {
    expect(isGuestVisibleEvent('estimate_submitted')).toBe(false)
    expect(guestEventLabel('estimate_submitted')).toBeNull()
  })

  it('shows repair lifecycle events', () => {
    expect(isGuestVisibleEvent('visit_scheduled')).toBe(true)
    expect(guestEventLabel('visit_scheduled')).toBe('Visit time agreed')
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildTechnicianJobSteps,
  getTechnicianNextAction,
} from '@/lib/complaints/technician-progress'
import type { Complaint } from '@/types'

function complaint(overrides: Partial<Complaint>): Complaint {
  return {
    id: 'abc12345-0000-4000-8000-000000000001',
    status: 'assigned',
    approval_stage: null,
    guest_id: 'guest-1',
    assigned_to: 'tech-1',
    scheduled_visit_at: null,
    guest_completion_approved_at: null,
    guests: { name: 'Ama', phone: '+233201234567' },
    ...overrides,
  } as Complaint
}

describe('buildTechnicianJobSteps', () => {
  it('highlights contact guest when visit not set', () => {
    const steps = buildTechnicianJobSteps(complaint({ status: 'assigned' }))
    const contact = steps.find((s) => s.id === 'contact')
    expect(contact?.state).toBe('current')
  })

  it('marks visit step current when assigned without visit', () => {
    const steps = buildTechnicianJobSteps(complaint({ status: 'assigned' }))
    const visit = steps.find((s) => s.id === 'visit')
    expect(visit?.state).toBe('current')
  })

  it('marks all steps complete when resolved', () => {
    const steps = buildTechnicianJobSteps(complaint({ status: 'resolved' }))
    expect(steps.every((s) => s.state === 'complete')).toBe(true)
  })
})

describe('getTechnicianNextAction', () => {
  it('prompts to call guest when no visit scheduled', () => {
    const action = getTechnicianNextAction(complaint({ status: 'assigned' }))
    expect(action?.type).toBe('contact_guest')
    expect(action?.actionKind).toBe('call')
    expect(action?.actionLabel).toBe('Call guest')
  })

  it('prompts to request sign-off when in progress', () => {
    const action = getTechnicianNextAction(
      complaint({
        status: 'in_progress',
        scheduled_visit_at: new Date().toISOString(),
      }),
    )
    expect(action?.type).toBe('mark_complete')
    expect(action?.actionKind).toBe('complete')
  })

  it('shows rework guidance when rejected', () => {
    const action = getTechnicianNextAction(
      complaint({ status: 'rejected', rejection_note: 'Leak still dripping' }),
    )
    expect(action?.type).toBe('rework')
    expect(action?.actionKind).toBe('scroll')
    expect(action?.detail).toMatch(/note/i)
  })

  it('shows message guest when awaiting guest sign-off', () => {
    const action = getTechnicianNextAction(
      complaint({ status: 'pending_approval', approval_stage: 'completion' }),
    )
    expect(action?.type).toBe('await_signoff')
    expect(action?.actionKind).toBe('message')
    expect(action?.actionLabel).toBe('Message guest')
  })
})

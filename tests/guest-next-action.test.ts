import { describe, expect, it } from 'vitest'
import {
  getGuestNextAction,
  pickGuestNextAction,
} from '@/lib/complaints/guest-next-action'
import type { Complaint } from '@/types'

function complaint(overrides: Partial<Complaint>): Complaint {
  return {
    id: 'abc12345-0000-4000-8000-000000000001',
    status: 'open',
    approval_stage: null,
    guest_id: 'guest-1',
    scheduled_visit_at: null,
    guest_completion_approved_at: null,
    category: 'plumbing',
    ...overrides,
  } as Complaint
}

describe('getGuestNextAction', () => {
  it('prioritises confirm repair when guest can approve', () => {
    const action = getGuestNextAction(
      complaint({ status: 'pending_approval', approval_stage: 'completion' }),
    )
    expect(action?.type).toBe('confirm_complete')
    expect(action?.actionLabel).toBe('Confirm repair')
    expect(action?.focus).toBe('approve')
  })

  it('shows visit banner when visit is scheduled', () => {
    const action = getGuestNextAction(
      complaint({
        status: 'assigned',
        scheduled_visit_at: '2030-06-15T10:00:00.000Z',
      }),
    )
    expect(action?.type).toBe('visit_scheduled')
    expect(action?.detail).toMatch(/visit/i)
  })

  it('returns null for resolved complaints', () => {
    expect(getGuestNextAction(complaint({ status: 'resolved' }))).toBeNull()
  })
})

describe('pickGuestNextAction', () => {
  it('picks the highest-priority open complaint', () => {
    const action = pickGuestNextAction([
      complaint({ id: '11111111-0000-4000-8000-000000000002', status: 'open' }),
      complaint({
        id: '22222222-0000-4000-8000-000000000003',
        status: 'pending_approval',
        approval_stage: 'completion',
      }),
    ])
    expect(action?.complaintId).toBe('22222222-0000-4000-8000-000000000003')
    expect(action?.type).toBe('confirm_complete')
  })
})

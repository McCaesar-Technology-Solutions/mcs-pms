import { describe, expect, it } from 'vitest'
import {
  canGuestApproveCompletion,
  canManagerApproveCompletion,
  canMarkComplete,
  canTechnicianScheduleVisit,
  canStartJob,
  canSubmitInvoice,
  isPendingCompletion,
  isPendingEstimate,
  managerPendingLabel,
  needsGuestCompletionApproval,
  technicianStatusLabel,
} from '@/lib/complaints/workflow'
import type { Complaint } from '@/types'

function complaint(overrides: Partial<Complaint>): Complaint {
  return { status: 'open', approval_stage: null, guest_id: null, ...overrides } as Complaint
}

describe('approval-stage detection', () => {
  it('distinguishes legacy estimate vs completion approvals', () => {
    const estimate = complaint({ status: 'pending_approval', approval_stage: 'estimate' })
    const completion = complaint({ status: 'pending_approval', approval_stage: 'completion' })

    expect(isPendingEstimate(estimate)).toBe(true)
    expect(isPendingCompletion(estimate)).toBe(false)

    expect(isPendingCompletion(completion)).toBe(true)
    expect(isPendingEstimate(completion)).toBe(false)
  })

  it('treats a null approval_stage while pending as a completion approval', () => {
    const legacy = complaint({ status: 'pending_approval', approval_stage: null })
    expect(isPendingCompletion(legacy)).toBe(true)
  })
})

describe('visit scheduling', () => {
  it('allows technician to schedule on assigned active jobs', () => {
    expect(canTechnicianScheduleVisit(complaint({ status: 'assigned' }))).toBe(true)
    expect(canTechnicianScheduleVisit(complaint({ status: 'in_progress' }))).toBe(true)
    expect(canTechnicianScheduleVisit(complaint({ status: 'rejected' }))).toBe(true)
    expect(canTechnicianScheduleVisit(complaint({ status: 'open' }))).toBe(false)
    expect(canTechnicianScheduleVisit(complaint({ status: 'pending_approval' }))).toBe(false)
    expect(canTechnicianScheduleVisit(complaint({ status: 'resolved' }))).toBe(false)
  })
})

describe('guest completion sign-off', () => {
  it('requires guest approval when a guest is linked', () => {
    const pending = complaint({
      guest_id: 'guest-1',
      status: 'pending_approval',
      approval_stage: 'completion',
    })
    expect(needsGuestCompletionApproval(pending)).toBe(true)
    expect(canGuestApproveCompletion(pending)).toBe(true)
    expect(canManagerApproveCompletion(pending)).toBe(false)
  })

  it('lets manager close staff-logged complaints without a guest', () => {
    const pending = complaint({ status: 'pending_approval', approval_stage: 'completion' })
    expect(needsGuestCompletionApproval(pending)).toBe(false)
    expect(canManagerApproveCompletion(pending)).toBe(true)
  })

  it('resolves via guest approval without manager step', () => {
    const approved = complaint({
      guest_id: 'guest-1',
      status: 'pending_approval',
      approval_stage: 'completion',
      guest_completion_approved_at: '2026-01-01T00:00:00Z',
    })
    expect(canGuestApproveCompletion(approved)).toBe(false)
    expect(canManagerApproveCompletion(approved)).toBe(true)
  })
})

describe('technician action gating', () => {
  it('allows optional invoice while active or awaiting sign-off', () => {
    expect(canSubmitInvoice(complaint({ status: 'assigned' }))).toBe(true)
    expect(canSubmitInvoice(complaint({ status: 'in_progress' }))).toBe(true)
    expect(canSubmitInvoice(complaint({ status: 'rejected' }))).toBe(true)
    expect(
      canSubmitInvoice(
        complaint({ status: 'pending_approval', approval_stage: 'completion' }),
      ),
    ).toBe(true)
    expect(canSubmitInvoice(complaint({ status: 'pending_approval', approval_stage: 'estimate' }))).toBe(
      false,
    )
  })

  it('allows starting a job as soon as it is assigned', () => {
    expect(canStartJob(complaint({ status: 'assigned' }))).toBe(true)
    expect(canStartJob(complaint({ status: 'in_progress' }))).toBe(false)
  })

  it('allows sign-off without an invoice from assigned or in progress', () => {
    expect(canMarkComplete(complaint({ status: 'assigned' }))).toBe(true)
    expect(canMarkComplete(complaint({ status: 'in_progress' }))).toBe(true)
    expect(canMarkComplete(complaint({ status: 'pending_approval' }))).toBe(false)
  })
})

describe('status labels', () => {
  it('produces manager approval labels per stage', () => {
    expect(
      managerPendingLabel(complaint({ status: 'pending_approval', approval_stage: 'estimate' })),
    ).toBe('Legacy invoice queue')
    expect(
      managerPendingLabel(complaint({ status: 'pending_approval', approval_stage: 'completion' })),
    ).toBe('Approve completion')
    expect(
      managerPendingLabel(
        complaint({
          guest_id: 'g1',
          status: 'pending_approval',
          approval_stage: 'completion',
        }),
      ),
    ).toBe('Awaiting guest sign-off')
  })

  it('produces technician-facing labels', () => {
    expect(technicianStatusLabel(complaint({ status: 'in_progress' }))).toBe('In progress')
    expect(technicianStatusLabel(complaint({ status: 'assigned' }))).toBe('Ready to start')
    expect(technicianStatusLabel(complaint({ status: 'rejected' }))).toBe('Sent back for rework')
    expect(
      technicianStatusLabel(
        complaint({
          guest_id: 'g1',
          status: 'pending_approval',
          approval_stage: 'completion',
        }),
      ),
    ).toBe('Awaiting guest sign-off')
  })
})

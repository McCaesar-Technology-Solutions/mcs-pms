import { describe, expect, it } from 'vitest'
import {
  canMarkComplete,
  canStartJob,
  canSubmitInvoice,
  isPendingCompletion,
  isPendingEstimate,
  managerPendingLabel,
  technicianStatusLabel,
} from '@/lib/complaints/workflow'
import type { Complaint } from '@/types'

function complaint(overrides: Partial<Complaint>): Complaint {
  return { status: 'open', approval_stage: null, ...overrides } as Complaint
}

describe('approval-stage detection', () => {
  it('distinguishes estimate vs completion approvals', () => {
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

describe('technician action gating', () => {
  it('allows invoice submission when assigned or sent back', () => {
    expect(canSubmitInvoice(complaint({ status: 'assigned' }))).toBe(true)
    expect(canSubmitInvoice(complaint({ status: 'rejected' }))).toBe(true)
    expect(canSubmitInvoice(complaint({ status: 'in_progress' }))).toBe(false)
  })

  it('only allows starting a job after the estimate is approved', () => {
    expect(
      canStartJob(complaint({ status: 'assigned', estimate_approved_at: '2026-01-01' })),
    ).toBe(true)
    expect(canStartJob(complaint({ status: 'assigned', estimate_approved_at: null }))).toBe(false)
  })

  it('only allows marking complete while in progress', () => {
    expect(canMarkComplete(complaint({ status: 'in_progress' }))).toBe(true)
    expect(canMarkComplete(complaint({ status: 'assigned' }))).toBe(false)
  })
})

describe('status labels', () => {
  it('produces manager approval labels per stage', () => {
    expect(
      managerPendingLabel(complaint({ status: 'pending_approval', approval_stage: 'estimate' })),
    ).toBe('Approve invoice')
    expect(
      managerPendingLabel(complaint({ status: 'pending_approval', approval_stage: 'completion' })),
    ).toBe('Approve completion')
  })

  it('produces technician-facing labels', () => {
    expect(technicianStatusLabel(complaint({ status: 'in_progress' }))).toBe('In progress')
    expect(technicianStatusLabel(complaint({ status: 'rejected' }))).toBe('Invoice sent back')
    expect(
      technicianStatusLabel(
        complaint({ status: 'assigned', estimate_approved_at: '2026-01-01' }),
      ),
    ).toBe('Ready to start')
  })
})

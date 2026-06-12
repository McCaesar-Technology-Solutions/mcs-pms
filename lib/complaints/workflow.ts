import type { Complaint } from '@/types'

export type ApprovalStage = 'estimate' | 'completion'

export function isPendingEstimate(c: Pick<Complaint, 'status' | 'approval_stage'>): boolean {
  return c.status === 'pending_approval' && c.approval_stage === 'estimate'
}

export function isPendingCompletion(c: Pick<Complaint, 'status' | 'approval_stage'>): boolean {
  return (
    c.status === 'pending_approval' &&
    (c.approval_stage === 'completion' || c.approval_stage == null)
  )
}

export function canSubmitInvoice(c: Pick<Complaint, 'status'>): boolean {
  return c.status === 'assigned' || c.status === 'rejected'
}

export function canStartJob(c: Pick<Complaint, 'status' | 'estimate_approved_at'>): boolean {
  return c.status === 'assigned' && Boolean(c.estimate_approved_at)
}

export function canMarkComplete(c: Pick<Complaint, 'status'>): boolean {
  return c.status === 'in_progress'
}

export function technicianStatusLabel(c: Complaint): string {
  if (isPendingEstimate(c)) return 'Invoice pending approval'
  if (isPendingCompletion(c)) return 'Completion pending approval'
  if (canStartJob(c)) return 'Ready to start'
  if (c.status === 'assigned') return 'Submit invoice'
  if (c.status === 'in_progress') return 'In progress'
  if (c.status === 'rejected') return 'Invoice sent back'
  if (c.status === 'resolved') return 'Resolved'
  return c.status ?? 'Assigned'
}

export function managerPendingLabel(c: Complaint): string {
  if (isPendingEstimate(c)) return 'Approve invoice'
  if (isPendingCompletion(c)) return 'Approve completion'
  return 'Pending approval'
}

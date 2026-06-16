import type { Complaint } from '@/types'

export type ApprovalStage = 'estimate' | 'completion'

/** @deprecated Legacy rows only — new invoices do not enter estimate approval. */
export function isPendingEstimate(c: Pick<Complaint, 'status' | 'approval_stage'>): boolean {
  return c.status === 'pending_approval' && c.approval_stage === 'estimate'
}

export function isPendingCompletion(c: Pick<Complaint, 'status' | 'approval_stage'>): boolean {
  return (
    c.status === 'pending_approval' &&
    (c.approval_stage === 'completion' || c.approval_stage == null)
  )
}

/** Optional — send anytime during the job or while awaiting manager sign-off. */
export function canSubmitInvoice(
  c: Pick<Complaint, 'status' | 'approval_stage'>,
): boolean {
  if (c.status === 'assigned' || c.status === 'in_progress' || c.status === 'rejected') {
    return true
  }
  return isPendingCompletion(c)
}

/** Start work as soon as the job is assigned — no invoice approval required. */
export function canStartJob(c: Pick<Complaint, 'status'>): boolean {
  return c.status === 'assigned'
}

/** Complete without an invoice — guest or manager sign-off follows. */
export function canMarkComplete(c: Pick<Complaint, 'status'>): boolean {
  return c.status === 'assigned' || c.status === 'in_progress' || c.status === 'rejected'
}

const TECHNICIAN_SCHEDULE_STATUSES = new Set(['assigned', 'in_progress', 'rejected'])

/** Technician schedules after agreeing a time with the guest (assigned jobs only). */
export function canTechnicianScheduleVisit(c: Pick<Complaint, 'status'>): boolean {
  return c.status != null && TECHNICIAN_SCHEDULE_STATUSES.has(c.status)
}

/** Guest must confirm work is done when the complaint is linked to a guest. */
export function needsGuestCompletionApproval(
  c: Pick<Complaint, 'guest_id' | 'status' | 'approval_stage'>,
): boolean {
  return Boolean(c.guest_id) && isPendingCompletion(c)
}

/** Guest can approve completion from the portal. */
export function canGuestApproveCompletion(
  c: Pick<Complaint, 'status' | 'approval_stage' | 'guest_completion_approved_at'>,
): boolean {
  return isPendingCompletion(c) && !c.guest_completion_approved_at
}

/** Manager closes jobs without a linked guest, or after guest has signed off. */
export function canManagerApproveCompletion(
  c: Pick<
    Complaint,
    'guest_id' | 'status' | 'approval_stage' | 'guest_completion_approved_at'
  >,
): boolean {
  if (!isPendingCompletion(c)) return false
  if (!c.guest_id) return true
  return Boolean(c.guest_completion_approved_at)
}

export function technicianStatusLabel(c: Complaint): string {
  if (isPendingEstimate(c)) return 'Invoice pending (legacy)'
  if (needsGuestCompletionApproval(c)) return 'Awaiting guest sign-off'
  if (isPendingCompletion(c)) return 'Completion pending approval'
  if (canStartJob(c)) return 'Ready to start'
  if (c.status === 'in_progress') return 'In progress'
  if (c.status === 'rejected') return 'Sent back for rework'
  if (c.status === 'resolved') return 'Resolved'
  return c.status ?? 'Assigned'
}

export function managerPendingLabel(c: Complaint): string {
  if (isPendingEstimate(c)) return 'Legacy invoice queue'
  if (needsGuestCompletionApproval(c)) return 'Awaiting guest sign-off'
  if (isPendingCompletion(c)) return 'Approve completion'
  return 'Pending approval'
}

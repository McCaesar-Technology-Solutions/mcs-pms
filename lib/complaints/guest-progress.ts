import type { Complaint, ComplaintEventType } from '@/types'
import { isPendingCompletion } from '@/lib/complaints/workflow'

export interface GuestRepairStep {
  id: string
  label: string
  detail?: string
  state: 'complete' | 'current' | 'upcoming'
}

export function guestComplaintReference(complaintId: string): string {
  return complaintId.slice(0, 8).toUpperCase()
}

export function buildGuestRepairSteps(complaint: Complaint): GuestRepairStep[] {
  const status = complaint.status ?? 'open'
  const hasAssignee = Boolean(complaint.assigned_to)
  const hasVisit = Boolean(complaint.scheduled_visit_at)
  const resolved = status === 'resolved'
  const rejected = status === 'rejected'
  const pendingGuestSignoff = isPendingCompletion(complaint) && !complaint.guest_completion_approved_at
  const guestSignedOff = Boolean(complaint.guest_completion_approved_at)

  const assignedDone =
    hasAssignee ||
    ['assigned', 'in_progress', 'pending_approval', 'resolved', 'rejected'].includes(status)

  const visitDone = hasVisit || resolved
  const visitCurrent = assignedDone && !visitDone && !rejected

  const workDone =
    resolved ||
    pendingGuestSignoff ||
    guestSignedOff ||
    status === 'pending_approval' ||
    status === 'in_progress'

  const workCurrent =
    !workDone &&
    !rejected &&
    ((status as Complaint['status']) === 'in_progress' || (assignedDone && hasVisit))

  const signoffDone = resolved || guestSignedOff
  const signoffCurrent = pendingGuestSignoff && !guestSignedOff

  function step(
    id: string,
    label: string,
    detail: string | undefined,
    complete: boolean,
    current: boolean,
  ): GuestRepairStep {
    return {
      id,
      label,
      detail,
      state: complete ? 'complete' : current ? 'current' : 'upcoming',
    }
  }

  const steps: GuestRepairStep[] = [
    step('received', 'Issue received', 'Our team has your report.', true, false),
    step(
      'assigned',
      'Technician assigned',
      assignedDone
        ? 'A technician is handling your room.'
        : 'A technician will be assigned shortly.',
      assignedDone,
      !assignedDone && !rejected,
    ),
    step(
      'visit',
      hasVisit ? 'Visit scheduled' : 'Agree a visit time',
      hasVisit
        ? undefined
        : visitCurrent
          ? 'Your technician will call you to agree when to visit.'
          : visitDone
            ? undefined
            : 'We will contact you to schedule access to your room.',
      visitDone,
      visitCurrent,
    ),
    step(
      'work',
      rejected ? 'Repair being redone' : workDone ? 'Repair completed' : 'Repair in progress',
      rejected
        ? 'The team is addressing outstanding work.'
        : workCurrent
          ? 'The technician is working on your issue.'
          : undefined,
      workDone || rejected,
      workCurrent || rejected,
    ),
  ]

  if (complaint.guest_id) {
    steps.push(
      step(
        'signoff',
        'Your confirmation',
        signoffCurrent
          ? 'Please confirm the repair meets your expectations.'
          : signoffDone
            ? 'You confirmed the work is complete.'
            : 'You will confirm when the repair is finished.',
        signoffDone,
        signoffCurrent,
      ),
    )
  }

  steps.push(
    step(
      'resolved',
      'All done',
      resolved ? 'This issue is closed. Thank you for your patience.' : undefined,
      resolved,
      !resolved && !rejected && signoffDone,
    ),
  )

  if (resolved) {
    return steps.map((s) => ({ ...s, state: 'complete' as const }))
  }

  return steps
}

const GUEST_VISIBLE_EVENTS = new Set<ComplaintEventType>([
  'submitted',
  'assigned',
  'visit_scheduled',
  'started',
  'completion_requested',
  'guest_completion_approved',
  'resolved',
])

export const GUEST_EVENT_LABELS: Record<ComplaintEventType, string | null> = {
  submitted: 'Issue reported',
  assigned: 'Technician assigned',
  visit_scheduled: 'Visit time agreed',
  started: 'Repair started',
  completion_requested: 'Repair finished — awaiting your confirmation',
  guest_completion_approved: 'You confirmed the repair',
  resolved: 'Issue closed',
  rejected: 'Team is reviewing again',
  estimate_submitted: null,
  estimate_approved: null,
}

export function isGuestVisibleEvent(type: ComplaintEventType): boolean {
  return GUEST_VISIBLE_EVENTS.has(type) || type === 'rejected'
}

export function guestEventLabel(type: ComplaintEventType): string | null {
  return GUEST_EVENT_LABELS[type]
}

import type { Complaint } from '@/types'
import {
  canMarkComplete,
  canStartJob,
  canTechnicianScheduleVisit,
  isPendingCompletion,
  isPendingEstimate,
  needsGuestCompletionApproval,
} from '@/lib/complaints/workflow'

export interface TechnicianJobStep {
  id: string
  label: string
  detail?: string
  state: 'complete' | 'current' | 'upcoming'
}

export type TechnicianNextActionType =
  | 'contact_guest'
  | 'schedule_visit'
  | 'start_job'
  | 'mark_complete'
  | 'await_signoff'
  | 'rework'
  | 'resolved'

export type TechnicianActionKind = 'scroll' | 'call' | 'start' | 'complete' | 'message' | 'none'

export interface TechnicianNextAction {
  type: TechnicianNextActionType
  title: string
  detail: string
  actionLabel?: string
  actionKind: TechnicianActionKind
  scrollTargetId?: string
}

export function technicianScrollTarget(
  complaintId: string,
  section: 'contact' | 'visit' | 'complete' | 'start' | 'rejection' | 'chat',
): string {
  return `tech-${section}-${complaintId}`
}

function step(
  id: string,
  label: string,
  detail: string | undefined,
  complete: boolean,
  current: boolean,
): TechnicianJobStep {
  return {
    id,
    label,
    detail,
    state: complete ? 'complete' : current ? 'current' : 'upcoming',
  }
}

export function buildTechnicianJobSteps(complaint: Complaint): TechnicianJobStep[] {
  const status = complaint.status ?? 'assigned'
  const hasVisit = Boolean(complaint.scheduled_visit_at)
  const resolved = status === 'resolved'
  const rejected = status === 'rejected'
  const inProgress = status === 'in_progress'
  const pending = isPendingCompletion(complaint)
  const legacyPending = isPendingEstimate(complaint)

  const contactDone = hasVisit || inProgress || pending || resolved || rejected
  const visitDone = hasVisit || resolved
  const visitCurrent = !visitDone && !rejected && canTechnicianScheduleVisit(complaint)

  const workStarted = inProgress || pending || resolved || rejected
  const workCurrent =
    !workStarted &&
    !rejected &&
    hasVisit &&
    (status === 'assigned' || status === 'in_progress')

  const submittedDone = pending || resolved
  const submittedCurrent = canMarkComplete(complaint) && !pending && !resolved

  const signoffDone = resolved
  const signoffCurrent = pending && !resolved

  const steps: TechnicianJobStep[] = [
    step('assigned', 'Job assigned', 'You have this task.', true, false),
    step(
      'contact',
      'Contact guest',
      contactDone
        ? 'Guest has been reached.'
        : 'Call or WhatsApp the guest to agree when to visit.',
      contactDone,
      !contactDone && !rejected,
    ),
    step(
      'visit',
      hasVisit ? 'Visit scheduled' : 'Set visit time',
      hasVisit
        ? undefined
        : visitCurrent
          ? 'Enter the time you agreed with the guest.'
          : undefined,
      visitDone,
      visitCurrent,
    ),
    step(
      'work',
      rejected ? 'Redo the repair' : workStarted ? 'Repair done' : 'Do the repair',
      rejected
        ? 'Address the manager note, then resubmit.'
        : workCurrent
          ? 'Start work when you arrive at the room.'
          : inProgress
            ? 'Finish the repair on site.'
            : undefined,
      workStarted || rejected,
      workCurrent || inProgress || rejected,
    ),
    step(
      'submit',
      'Request sign-off',
      submittedCurrent
        ? 'Tap below when the repair is finished.'
        : submittedDone
          ? 'Waiting for guest or manager approval.'
          : undefined,
      submittedDone,
      submittedCurrent,
    ),
  ]

  if (complaint.guest_id) {
    steps.push(
      step(
        'guest_signoff',
        'Guest confirms',
        signoffCurrent
          ? 'Guest must confirm in their portal.'
          : signoffDone
            ? 'Guest signed off.'
            : 'Guest will confirm when satisfied.',
        signoffDone || Boolean(complaint.guest_completion_approved_at),
        signoffCurrent && needsGuestCompletionApproval(complaint),
      ),
    )
  }

  steps.push(
    step(
      'resolved',
      'Job closed',
      resolved ? 'This task is complete.' : undefined,
      resolved,
      false,
    ),
  )

  if (legacyPending) {
    return steps.map((s) =>
      s.id === 'work'
        ? {
            ...s,
            label: 'Legacy invoice queue',
            detail: 'Ask your manager to release this job.',
            state: 'current' as const,
          }
        : s,
    )
  }

  if (resolved) {
    return steps.map((s) => ({ ...s, state: 'complete' as const }))
  }

  return steps
}

export function getTechnicianNextAction(complaint: Complaint): TechnicianNextAction | null {
  const status = complaint.status ?? 'assigned'
  const id = complaint.id

  if (status === 'resolved') {
    return {
      type: 'resolved',
      title: 'Job complete',
      detail: 'This task is closed.',
      actionKind: 'none',
    }
  }

  if (isPendingEstimate(complaint)) {
    return {
      type: 'await_signoff',
      title: 'Waiting on manager',
      detail: 'This job is in a legacy approval queue. Ask your manager to release it.',
      actionKind: 'none',
    }
  }

  if (status === 'rejected') {
    return {
      type: 'rework',
      title: 'Manager sent this back',
      detail: complaint.rejection_note?.trim()
        ? 'Read the note below, finish the work, then request sign-off again.'
        : 'Finish the outstanding work, then request sign-off again.',
      actionLabel: 'View manager note',
      actionKind: 'scroll',
      scrollTargetId: technicianScrollTarget(id, 'rejection'),
    }
  }

  if (isPendingCompletion(complaint)) {
    const guestWaiting = needsGuestCompletionApproval(complaint)
    return {
      type: 'await_signoff',
      title: guestWaiting ? 'Awaiting guest sign-off' : 'Awaiting manager sign-off',
      detail: guestWaiting
        ? 'The guest will confirm in their portal. You can nudge them below if needed.'
        : 'Your manager will review and close the job.',
      actionLabel: guestWaiting ? 'Message guest' : undefined,
      actionKind: guestWaiting ? 'message' : 'none',
      scrollTargetId: guestWaiting ? technicianScrollTarget(id, 'chat') : undefined,
    }
  }

  if (canTechnicianScheduleVisit(complaint) && !complaint.scheduled_visit_at) {
    const hasGuestPhone = Boolean(complaint.guests?.phone)
    if (hasGuestPhone) {
      return {
        type: 'contact_guest',
        title: 'Call the guest first',
        detail: 'Agree a visit time, then enter it below.',
        actionLabel: 'Call guest',
        actionKind: 'call',
        scrollTargetId: technicianScrollTarget(id, 'contact'),
      }
    }
    return {
      type: 'schedule_visit',
      title: 'Set visit time',
      detail: 'Enter when you will visit the room.',
      actionLabel: 'Set visit time',
      actionKind: 'scroll',
      scrollTargetId: technicianScrollTarget(id, 'visit'),
    }
  }

  if (canStartJob(complaint) && status === 'assigned' && complaint.scheduled_visit_at) {
    return {
      type: 'start_job',
      title: 'Ready to start',
      detail: 'Mark as started when you begin work (optional).',
      actionLabel: 'Mark as started',
      actionKind: 'start',
      scrollTargetId: technicianScrollTarget(id, 'start'),
    }
  }

  if (canMarkComplete(complaint)) {
    return {
      type: 'mark_complete',
      title: 'Finish the repair?',
      detail: 'Request sign-off once the issue is fixed.',
      actionLabel: 'Request sign-off',
      actionKind: 'complete',
      scrollTargetId: technicianScrollTarget(id, 'complete'),
    }
  }

  return null
}

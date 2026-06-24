import type { Complaint } from '@/types'
import { formatComplaintVisit } from '@/lib/complaints/visit'
import { canGuestApproveCompletion } from '@/lib/complaints/workflow'
import { guestComplaintReference } from '@/lib/complaints/guest-progress'

export type GuestNextActionFocus = 'approve' | 'progress' | 'chat'

export type GuestNextActionType =
  | 'confirm_complete'
  | 'visit_scheduled'
  | 'awaiting_visit'
  | 'being_handled'
  | 'being_reviewed'

export interface GuestNextAction {
  complaintId: string
  reference: string
  category: string
  type: GuestNextActionType
  title: string
  detail: string
  actionLabel: string
  focus: GuestNextActionFocus
}

function complaintPriority(c: Complaint): number {
  if (canGuestApproveCompletion(c)) return 0
  if (c.scheduled_visit_at) return 1
  if (c.status === 'in_progress') return 2
  if (c.status === 'assigned') return 3
  if (c.status === 'rejected') return 4
  if (c.status === 'open') return 5
  if (c.status === 'pending_approval') return 6
  return 7
}

export function getGuestNextAction(complaint: Complaint): GuestNextAction | null {
  const status = complaint.status ?? 'open'
  const reference = guestComplaintReference(complaint.id)
  const category = complaint.category

  if (status === 'resolved') return null

  if (canGuestApproveCompletion(complaint)) {
    return {
      complaintId: complaint.id,
      reference,
      category,
      type: 'confirm_complete',
      title: 'Confirm the repair',
      detail: 'Your technician has finished. Please confirm the work meets your expectations.',
      actionLabel: 'Confirm repair',
      focus: 'approve',
    }
  }

  if (complaint.scheduled_visit_at) {
    const when = formatComplaintVisit(complaint.scheduled_visit_at)
    return {
      complaintId: complaint.id,
      reference,
      category,
      type: 'visit_scheduled',
      title: 'Maintenance visit confirmed',
      detail: when ? `Your technician will visit ${when}.` : 'A visit time has been agreed.',
      actionLabel: 'View visit details',
      focus: 'progress',
    }
  }

  if (['assigned', 'in_progress'].includes(status)) {
    return {
      complaintId: complaint.id,
      reference,
      category,
      type: 'being_handled',
      title: 'Repair in progress',
      detail: 'A technician is working on your issue. They will call to agree a visit time if needed.',
      actionLabel: 'Track progress',
      focus: 'progress',
    }
  }

  if (status === 'open') {
    return {
      complaintId: complaint.id,
      reference,
      category,
      type: 'being_reviewed',
      title: 'Issue received',
      detail: 'Our team is reviewing your report and will assign a technician shortly.',
      actionLabel: 'View status',
      focus: 'progress',
    }
  }

  if (status === 'rejected') {
    return {
      complaintId: complaint.id,
      reference,
      category,
      type: 'being_handled',
      title: 'Repair being redone',
      detail: 'The team is addressing outstanding work on your issue.',
      actionLabel: 'View progress',
      focus: 'progress',
    }
  }

  if (status === 'pending_approval') {
    return {
      complaintId: complaint.id,
      reference,
      category,
      type: 'being_handled',
      title: 'Awaiting final sign-off',
      detail: 'The repair is complete and waiting for approval to close.',
      actionLabel: 'View details',
      focus: 'progress',
    }
  }

  return null
}

export function pickGuestNextAction(complaints: Complaint[]): GuestNextAction | null {
  const open = complaints.filter((c) => c.status !== 'resolved')
  if (open.length === 0) return null

  const sorted = [...open].sort((a, b) => complaintPriority(a) - complaintPriority(b))
  return getGuestNextAction(sorted[0]!)
}

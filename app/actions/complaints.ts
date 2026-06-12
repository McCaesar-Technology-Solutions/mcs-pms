'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import type { Complaint, ComplaintEvent, ComplaintPriority, DbRoomStatus } from '@/types'

export type ComplaintActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireStaffProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return profile
}

export async function getHotelComplaints(): Promise<ComplaintActionResult<Complaint[]>> {
  try {
    const data = await fetchHotelComplaints()
    return { success: true, data }
  } catch {
    return { success: false, error: 'Could not load complaints.' }
  }
}

export async function getTechnicianComplaints(
  includeCompleted = false,
): Promise<ComplaintActionResult<Complaint[]>> {
  const supabase = await createClient()
  let query = supabase
    .from('complaints')
    .select('*, rooms(number)')
    .order('priority', { ascending: true })

  if (includeCompleted) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    query = query.or(
      `status.in.(assigned,in_progress,pending_approval,rejected),and(status.eq.resolved,resolved_at.gte.${thirtyDaysAgo.toISOString()})`,
    )
  } else {
    query = query.in('status', ['assigned', 'in_progress', 'pending_approval', 'rejected'])
  }

  const { data, error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as unknown as Complaint[] }
}

export async function assignComplaint(
  complaintId: string,
  technicianId: string,
  priority?: ComplaintPriority,
): Promise<ComplaintActionResult> {
  const profile = await requireStaffProfile()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const supabase = await createClient()
  const updatePayload: {
    assigned_to: string
    status: 'assigned'
    approval_stage: null
    estimate_approved_at: null
    rejection_note: null
    priority?: ComplaintPriority
  } = {
    assigned_to: technicianId,
    status: 'assigned',
    approval_stage: null,
    estimate_approved_at: null,
    rejection_note: null,
  }
  if (priority) updatePayload.priority = priority

  const { error } = await supabase.from('complaints').update(updatePayload).eq('id', complaintId)
  if (error) return { success: false, error: error.message }

  await supabase.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_id: profile.id,
    actor_role: profile.role,
    event_type: 'assigned',
  })

  void import('@/lib/notifications/complaints').then(({ notifyComplaintAssigned }) =>
    notifyComplaintAssigned(complaintId, technicianId).catch(() => undefined),
  )

  revalidatePath('/manager/complaints')
  return { success: true }
}

export async function approveComplaint(
  complaintId: string,
  roomStatus?: DbRoomStatus,
): Promise<ComplaintActionResult> {
  const profile = await requireStaffProfile()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const supabase = await createClient()
  const { data: complaint } = await supabase
    .from('complaints')
    .select('room_id, status, approval_stage, assigned_to')
    .eq('id', complaintId)
    .maybeSingle()

  if (!complaint || complaint.status !== 'pending_approval') {
    return { success: false, error: 'This complaint is not awaiting approval.' }
  }

  const isEstimate = complaint.approval_stage === 'estimate'

  if (isEstimate) {
    const { error } = await supabase
      .from('complaints')
      .update({
        status: 'assigned',
        approval_stage: null,
        estimate_approved_at: new Date().toISOString(),
        rejection_note: null,
      })
      .eq('id', complaintId)

    if (error) return { success: false, error: error.message }

    await supabase.from('complaint_events').insert({
      complaint_id: complaintId,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: 'estimate_approved',
      note: 'Invoice approved — technician may start work.',
    })

    if (complaint.assigned_to) {
      void import('@/lib/notifications/complaints').then(({ notifyComplaintEstimateApproved }) =>
        notifyComplaintEstimateApproved(complaintId, complaint.assigned_to!).catch(() => undefined),
      )
    }
  } else {
    const { error } = await supabase
      .from('complaints')
      .update({
        status: 'resolved',
        approval_stage: null,
        resolved_at: new Date().toISOString(),
        rejection_note: null,
      })
      .eq('id', complaintId)

    if (error) return { success: false, error: error.message }

    await supabase.from('complaint_events').insert({
      complaint_id: complaintId,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: 'resolved',
    })

    if (roomStatus && complaint.room_id) {
      await supabase
        .from('rooms')
        .update({ status: roomStatus, updated_by: profile.id })
        .eq('id', complaint.room_id)
    }
  }

  revalidatePath('/manager/complaints')
  revalidatePath('/technician/tasks')
  return { success: true }
}

export async function rejectComplaint(
  complaintId: string,
  rejectionNote: string,
): Promise<ComplaintActionResult> {
  if (!rejectionNote.trim()) {
    return { success: false, error: 'Rejection note is required.' }
  }

  const profile = await requireStaffProfile()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const supabase = await createClient()
  const { data: complaint } = await supabase
    .from('complaints')
    .select('status, approval_stage')
    .eq('id', complaintId)
    .maybeSingle()

  if (!complaint || complaint.status !== 'pending_approval') {
    return { success: false, error: 'This complaint is not awaiting approval.' }
  }

  const isEstimate = complaint.approval_stage === 'estimate'
  const note = rejectionNote.trim()

  const { error } = await supabase
    .from('complaints')
    .update(
      isEstimate
        ? { status: 'rejected', approval_stage: null, rejection_note: note }
        : { status: 'in_progress', approval_stage: null, rejection_note: note },
    )
    .eq('id', complaintId)

  if (error) return { success: false, error: error.message }

  await supabase.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_id: profile.id,
    actor_role: profile.role,
    event_type: 'rejected',
    note: rejectionNote.trim(),
  })

  revalidatePath('/manager/complaints')
  revalidatePath('/technician/tasks')
  return { success: true }
}

export async function startTechnicianComplaint(complaintId: string): Promise<ComplaintActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'technician') {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: complaint } = await supabase
    .from('complaints')
    .select('status, estimate_approved_at')
    .eq('id', complaintId)
    .eq('assigned_to', user.id)
    .maybeSingle()

  if (!complaint || complaint.status !== 'assigned' || !complaint.estimate_approved_at) {
    return { success: false, error: 'Invoice must be approved before you can start this job.' }
  }

  const { error } = await supabase
    .from('complaints')
    .update({ status: 'in_progress', rejection_note: null })
    .eq('id', complaintId)
    .eq('assigned_to', user.id)

  if (error) return { success: false, error: error.message }

  await supabase.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_id: user.id,
    actor_role: 'technician',
    event_type: 'started',
  })

  revalidatePath('/technician/tasks')
  revalidatePath('/manager/complaints')
  return { success: true }
}

export async function markComplaintComplete(complaintId: string): Promise<ComplaintActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'technician') {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: complaint } = await supabase
    .from('complaints')
    .select('status')
    .eq('id', complaintId)
    .eq('assigned_to', user.id)
    .maybeSingle()

  if (!complaint || complaint.status !== 'in_progress') {
    return { success: false, error: 'You can only mark in-progress jobs as complete.' }
  }

  const { error } = await supabase
    .from('complaints')
    .update({ status: 'pending_approval', approval_stage: 'completion', rejection_note: null })
    .eq('id', complaintId)
    .eq('assigned_to', user.id)

  if (error) return { success: false, error: error.message }

  await supabase.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_id: user.id,
    actor_role: 'technician',
    event_type: 'completion_requested',
  })

  void import('@/lib/notifications/complaints').then(({ notifyComplaintCompletionRequested }) =>
    notifyComplaintCompletionRequested(complaintId).catch(() => undefined),
  )

  revalidatePath('/technician/tasks')
  revalidatePath('/manager/complaints')
  return { success: true }
}

/** @deprecated Use startTechnicianComplaint or markComplaintComplete */
export async function updateTechnicianComplaintStatus(
  complaintId: string,
  status: 'in_progress' | 'pending_approval',
): Promise<ComplaintActionResult> {
  if (status === 'in_progress') return startTechnicianComplaint(complaintId)
  return markComplaintComplete(complaintId)
}

export async function getComplaintEvents(
  complaintId: string,
): Promise<ComplaintActionResult<ComplaintEvent[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('complaint_events')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as ComplaintEvent[] }
}

export async function getTechnicians(): Promise<
  ComplaintActionResult<{ id: string; name: string; specialty: string | null; phone: string | null }[]>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, specialty, phone')
    .eq('role', 'technician')
    .eq('is_active', true)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

export async function getHotelRooms(): Promise<
  ComplaintActionResult<{ id: string; number: string }[]>
> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('rooms').select('id, number').order('number')
  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

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
  return { success: true, data: (data ?? []) as Complaint[] }
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
    priority?: ComplaintPriority
  } = {
    assigned_to: technicianId,
    status: 'assigned',
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
    .select('room_id')
    .eq('id', complaintId)
    .maybeSingle()

  const { error } = await supabase
    .from('complaints')
    .update({ status: 'resolved', resolved_at: new Date().toISOString(), rejection_note: null })
    .eq('id', complaintId)

  if (error) return { success: false, error: error.message }

  await supabase.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_id: profile.id,
    actor_role: profile.role,
    event_type: 'resolved',
  })

  if (roomStatus && complaint?.room_id) {
    await supabase
      .from('rooms')
      .update({ status: roomStatus, updated_by: profile.id })
      .eq('id', complaint.room_id)
  }

  revalidatePath('/manager/complaints')
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
  const { error } = await supabase
    .from('complaints')
    .update({ status: 'rejected', rejection_note: rejectionNote.trim() })
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

export async function updateTechnicianComplaintStatus(
  complaintId: string,
  status: 'in_progress' | 'pending_approval',
): Promise<ComplaintActionResult> {
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

  const { error } = await supabase
    .from('complaints')
    .update({ status })
    .eq('id', complaintId)
    .eq('assigned_to', user.id)

  if (error) return { success: false, error: error.message }

  const eventType = status === 'in_progress' ? 'started' : 'completion_requested'
  await supabase.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_id: user.id,
    actor_role: 'technician',
    event_type: eventType,
  })

  revalidatePath('/technician/tasks')
  revalidatePath('/manager/complaints')
  return { success: true }
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
  ComplaintActionResult<{ id: string; name: string; specialty: string | null }[]>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, specialty')
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

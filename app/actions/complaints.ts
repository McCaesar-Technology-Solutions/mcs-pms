'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/audit/log'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { isVisitTimeValid, parseVisitDateTime } from '@/lib/complaints/visit'
import { canManagerApproveCompletion, canTechnicianScheduleVisit } from '@/lib/complaints/workflow'
import { scheduleComplaintVisitSchema } from '@/lib/validations'
import type { Complaint, ComplaintEvent, ComplaintPriority, DbRoomStatus } from '@/types'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'
import { canEditOwnMessage } from '@/lib/messaging/can-edit-message'

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

async function assertComplaintStaffAccess(
  complaintId: string,
  profile: NonNullable<Awaited<ReturnType<typeof requireStaffProfile>>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()

  if (profile.role === 'technician') {
    const { data: complaint } = await supabase
      .from('complaints')
      .select('id')
      .eq('id', complaintId)
      .eq('assigned_to', profile.id)
      .maybeSingle()

    if (!complaint) return { ok: false, error: 'Complaint not found.' }
    return { ok: true }
  }

  if (!profile.hotel_id) return { ok: false, error: 'Not authorized.' }

  const { data: complaint } = await supabase
    .from('complaints')
    .select('id')
    .eq('id', complaintId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!complaint) return { ok: false, error: 'Complaint not found.' }
  return { ok: true }
}

export async function getHotelComplaints(): Promise<ComplaintActionResult<Complaint[]>> {
  try {
    const data = await fetchHotelComplaints()
    return { success: true, data }
  } catch {
    return { success: false, error: 'Could not load complaints.' }
  }
}

export interface ComplaintFormRoom {
  id: string
  number: string
}

export interface ComplaintFormGuest {
  id: string
  name: string
  roomId: string | null
  roomNumber: string | null
}

/** Rooms + currently-staying guests for the staff "log complaint" form. */
export async function getComplaintFormOptions(): Promise<
  ComplaintActionResult<{ rooms: ComplaintFormRoom[]; guests: ComplaintFormGuest[] }>
> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const supabase = await createClient()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const [{ data: rooms }, { data: guests }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, number')
      .eq('hotel_id', profile.hotel_id)
      .order('number'),
    supabase
      .from('guests')
      .select('id, name, room_id, check_out, rooms(number)')
      .eq('hotel_id', profile.hotel_id)
      .not('room_id', 'is', null)
      .or(`check_out.is.null,check_out.gte.${startOfToday.toISOString()}`)
      .order('name'),
  ])

  return {
    success: true,
    data: {
      rooms: (rooms ?? []) as ComplaintFormRoom[],
      guests: ((guests ?? []) as unknown as Array<{
        id: string
        name: string
        room_id: string | null
        rooms: { number: string } | null
      }>).map((g) => ({
        id: g.id,
        name: g.name,
        roomId: g.room_id,
        roomNumber: g.rooms?.number ?? null,
      })),
    },
  }
}

/** Lets an owner/manager/receptionist log a complaint on behalf of a guest or room. */
export async function createStaffComplaint(input: unknown): Promise<ComplaintActionResult> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { staffComplaintSchema } = await import('@/lib/validations')
  const parsed = staffComplaintSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid complaint.' }
  }

  // Admin client: complaints have no staff INSERT policy (guests insert via the
  // portal's admin path), so staff-logged complaints are written server-side.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  let roomId = parsed.data.roomId ?? null
  const guestId = parsed.data.guestId ?? null

  // A linked guest determines the room when one isn't explicitly chosen.
  if (guestId) {
    const { data: guest } = await admin
      .from('guests')
      .select('room_id')
      .eq('id', guestId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()
    if (!guest) return { success: false, error: 'Guest not found.' }
    if (!roomId) roomId = guest.room_id
  }

  if (!roomId && !guestId) {
    return { success: false, error: 'Select a room or a guest.' }
  }

  const { computeComplaintSlaDueAt } = await import('@/lib/complaints/sla')

  const { data: complaint, error } = await admin
    .from('complaints')
    .insert({
      hotel_id: profile.hotel_id,
      room_id: roomId,
      guest_id: guestId,
      category: parsed.data.category,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: 'open',
      sla_due_at: computeComplaintSlaDueAt(parsed.data.priority),
    })
    .select('id')
    .single()

  if (error || !complaint) {
    return { success: false, error: error?.message ?? 'Could not log complaint.' }
  }

  await admin.from('complaint_events').insert({
    complaint_id: complaint.id,
    actor_id: profile.id,
    actor_role: profile.role,
    event_type: 'submitted',
    note: parsed.data.description.slice(0, 200),
  })

  void import('@/lib/notifications/complaints').then(({ notifyComplaintSubmitted, notifyGuestComplaintReceived }) => {
    notifyComplaintSubmitted(complaint.id).catch(() => undefined)
    notifyGuestComplaintReceived(complaint.id).catch(() => undefined)
  })

  revalidatePath('/manager/complaints')
  revalidatePath('/owner/complaints')
  revalidatePath('/receptionist/complaints')
  return { success: true }
}

/** Pending manager/owner approvals — used for live sidebar badge updates. */
export async function getPendingComplaintApprovalsCount(): Promise<number> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id || !['owner', 'manager'].includes(profile.role)) return 0

  const supabase = await createClient()
  const { count } = await supabase
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('hotel_id', profile.hotel_id)
    .eq('status', 'pending_approval')

  return count ?? 0
}

export async function getTechnicianComplaints(
  includeCompleted = false,
): Promise<ComplaintActionResult<Complaint[]>> {
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

  // Admin client so we can join guest contact details (guests are hidden from
  // technicians by RLS). Scoped to jobs assigned to this technician only.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  let query = admin
    .from('complaints')
    .select('*, rooms(number), guests(name, phone)')
    .eq('assigned_to', user.id)
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

  if (profile.hotel_id) {
    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'complaint',
      entityId: complaintId,
      action: 'assigned',
      summary: 'Technician assigned to complaint',
    })
  }

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
    .select('room_id, status, approval_stage, assigned_to, guest_id, guest_completion_approved_at')
    .eq('id', complaintId)
    .maybeSingle()

  if (!complaint || complaint.status !== 'pending_approval') {
    return { success: false, error: 'This complaint is not awaiting approval.' }
  }

  const isEstimate = complaint.approval_stage === 'estimate'

  if (!isEstimate && complaint.guest_id && !complaint.guest_completion_approved_at) {
    return {
      success: false,
      error: 'Waiting for the guest to confirm the work is complete.',
    }
  }

  if (!isEstimate && !canManagerApproveCompletion(complaint)) {
    return { success: false, error: 'This complaint cannot be approved yet.' }
  }

  if (isEstimate) {
    // Legacy rows stuck in estimate approval — release back to the technician.
    const { error } = await supabase
      .from('complaints')
      .update({
        status: 'assigned',
        approval_stage: null,
        rejection_note: null,
      })
      .eq('id', complaintId)

    if (error) return { success: false, error: error.message }

    await supabase.from('complaint_events').insert({
      complaint_id: complaintId,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: 'estimate_approved',
      note: 'Legacy invoice queue cleared — technician may proceed.',
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

export async function scheduleTechnicianComplaintVisit(
  input: unknown,
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

  const parsed = scheduleComplaintVisitSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid visit time.' }
  }

  const visitAt = parseVisitDateTime(parsed.data.visitAt)
  if (!visitAt) {
    return { success: false, error: 'Invalid date and time.' }
  }
  if (!isVisitTimeValid(visitAt)) {
    return { success: false, error: 'Visit must be at least 30 minutes from now.' }
  }

  const { data: complaint } = await supabase
    .from('complaints')
    .select('status')
    .eq('id', parsed.data.complaintId)
    .eq('assigned_to', user.id)
    .maybeSingle()

  if (!complaint || !canTechnicianScheduleVisit(complaint)) {
    return { success: false, error: 'This job is not ready to schedule.' }
  }

  const visitIso = visitAt.toISOString()
  const admin = createAdminClient()

  const { error } = await admin
    .from('complaints')
    .update({
      scheduled_visit_at: visitIso,
      scheduled_visit_by: 'technician',
    })
    .eq('id', parsed.data.complaintId)
    .eq('assigned_to', user.id)

  if (error) return { success: false, error: error.message }

  await admin.from('complaint_events').insert({
    complaint_id: parsed.data.complaintId,
    actor_id: user.id,
    actor_role: 'technician',
    event_type: 'visit_scheduled',
    note: visitIso,
  })

  void import('@/lib/notifications/complaints').then(({ notifyComplaintVisitScheduled }) =>
    notifyComplaintVisitScheduled(parsed.data.complaintId, visitIso).catch(() => undefined),
  )

  revalidatePath('/technician/tasks')
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
        ? { status: 'assigned', approval_stage: null, rejection_note: note }
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

  void import('@/lib/notifications/complaints').then(({ notifyComplaintRejected }) =>
    notifyComplaintRejected(complaintId, note).catch(() => undefined),
  )

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
    .select('status')
    .eq('id', complaintId)
    .eq('assigned_to', user.id)
    .maybeSingle()

  if (!complaint || complaint.status !== 'assigned') {
    return { success: false, error: 'This job is not ready to start.' }
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

  if (
    !complaint ||
    !['assigned', 'in_progress', 'rejected'].includes(complaint.status ?? '')
  ) {
    return { success: false, error: 'This job cannot be marked complete yet.' }
  }

  if (complaint.status === 'assigned') {
    await supabase.from('complaint_events').insert({
      complaint_id: complaintId,
      actor_id: user.id,
      actor_role: 'technician',
      event_type: 'started',
    })
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

const complaintMessageSchema = z.object({
  complaintId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

const editComplaintMessageSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

export async function getStaffComplaintMessages(
  complaintId: string,
): Promise<
  ComplaintActionResult<
    {
      id: string
      authorRole: string
      body: string
      createdAt: string
      authorName: string | null
      authorAvatarUrl: string | null
      editedAt?: string | null
      canEdit?: boolean
    }[]
  >
> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const access = await assertComplaintStaffAccess(complaintId, profile)
  if (!access.ok) return { success: false, error: access.error }

  const admin = createAdminClient()

  const { data: complaint } = await admin
    .from('complaints')
    .select('guest_id, guest_last_read_at, guests(name, profile_image_path)')
    .eq('id', complaintId)
    .maybeSingle()

  const guestRow = complaint?.guests as {
    name?: string
    profile_image_path?: string | null
  } | null
  const guestAvatarUrl = profilePhotoPublicUrl(guestRow?.profile_image_path)
  const guestLastRead = complaint?.guest_last_read_at

  await admin
    .from('complaints')
    .update({ staff_last_read_at: new Date().toISOString() })
    .eq('id', complaintId)

  const { data } = await admin
    .from('complaint_messages')
    .select('id, author_role, body, created_at, edited_at, author_id, profiles(name, profile_image_path)')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  return {
    success: true,
    data: (data ?? []).map((m) => {
      const authorProfile =
        m.profiles && typeof m.profiles === 'object' && 'name' in m.profiles
          ? (m.profiles as { name: string; profile_image_path?: string | null })
          : null
      const isGuestRole = m.author_role === 'guest'
      return {
        id: m.id,
        authorRole: m.author_role,
        body: m.body,
        createdAt: m.created_at ?? new Date(0).toISOString(),
        editedAt: m.edited_at ?? null,
        authorName: isGuestRole ? (guestRow?.name ?? 'Guest') : (authorProfile?.name ?? null),
        authorAvatarUrl: isGuestRole
          ? guestAvatarUrl
          : profilePhotoPublicUrl(authorProfile?.profile_image_path),
        canEdit:
          !isGuestRole &&
          m.author_id === profile.id &&
          canEditOwnMessage(m.created_at ?? new Date(0).toISOString(), [guestLastRead]),
      }
    }),
  }
}

export async function postStaffComplaintMessage(
  input: unknown,
): Promise<ComplaintActionResult> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const parsed = complaintMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const access = await assertComplaintStaffAccess(parsed.data.complaintId, profile)
  if (!access.ok) return { success: false, error: access.error }

  const admin = createAdminClient()
  const { error } = await admin.from('complaint_messages').insert({
    complaint_id: parsed.data.complaintId,
    author_role: 'staff',
    author_id: profile.id,
    body: parsed.data.body.trim(),
  })

  if (error) return { success: false, error: 'Could not send message.' }

  void import('@/lib/notifications/complaints').then(({ notifyComplaintStaffMessageToGuest }) =>
    notifyComplaintStaffMessageToGuest(parsed.data.complaintId, parsed.data.body.trim()).catch(
      () => undefined,
    ),
  )

  revalidatePath('/manager/complaints')
  revalidatePath('/receptionist/complaints')
  revalidatePath('/technician/tasks')
  revalidatePath('/guest')
  return { success: true }
}

export async function editStaffComplaintMessage(
  input: unknown,
): Promise<ComplaintActionResult> {
  const profile = await requireStaffProfile()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const parsed = editComplaintMessageSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message.' }
  }

  const admin = createAdminClient()
  const { data: message } = await admin
    .from('complaint_messages')
    .select('id, complaint_id, author_id, author_role, created_at')
    .eq('id', parsed.data.messageId)
    .maybeSingle()

  if (!message || message.author_role !== 'staff' || message.author_id !== profile.id) {
    return { success: false, error: 'Message not found.' }
  }

  const access = await assertComplaintStaffAccess(message.complaint_id, profile)
  if (!access.ok) return { success: false, error: access.error }

  const { data: complaint } = await admin
    .from('complaints')
    .select('guest_last_read_at')
    .eq('id', message.complaint_id)
    .maybeSingle()

  if (
    !canEditOwnMessage(message.created_at ?? new Date(0).toISOString(), [
      complaint?.guest_last_read_at,
    ])
  ) {
    return { success: false, error: 'This message can no longer be edited.' }
  }

  const { error } = await admin
    .from('complaint_messages')
    .update({ body: parsed.data.body.trim(), edited_at: new Date().toISOString() })
    .eq('id', message.id)

  if (error) return { success: false, error: 'Could not update message.' }

  revalidatePath('/manager/complaints')
  revalidatePath('/receptionist/complaints')
  revalidatePath('/technician/tasks')
  revalidatePath('/guest')
  return { success: true }
}

export async function getTechnicianComplaintPhotoUrl(
  complaintId: string,
): Promise<ComplaintActionResult<{ url: string }>> {
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

  const admin = createAdminClient()
  const { data } = await admin
    .from('complaints')
    .select('guest_photo_path')
    .eq('id', complaintId)
    .eq('assigned_to', user.id)
    .maybeSingle()

  if (!data?.guest_photo_path) return { success: false, error: 'No photo attached.' }

  const { GUEST_COMPLAINT_PHOTO_BUCKET } = await import('@/lib/guest/complaint-photos')
  const { data: signed } = await admin.storage
    .from(GUEST_COMPLAINT_PHOTO_BUCKET)
    .createSignedUrl(data.guest_photo_path, 3600)

  if (!signed?.signedUrl) return { success: false, error: 'Could not load photo.' }
  return { success: true, data: { url: signed.signedUrl } }
}

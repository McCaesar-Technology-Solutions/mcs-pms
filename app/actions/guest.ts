'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getGuestSessionId } from '@/lib/guest-session'
import { guestNeedsRulesAcceptance } from '@/app/actions/guest-rules'
import { submitComplaintSchema } from '@/lib/validations'
import { canGuestApproveCompletion } from '@/lib/complaints/workflow'
import { walkInCheckIn, checkOutStay } from '@/app/actions/stays'
import { getOccupancySpans } from '@/lib/data/occupancy'
import type { Complaint, Guest } from '@/types'

export type GuestActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const RATE_WINDOW_MS = 15 * 60 * 1000
const MAX_PER_WINDOW = 3
const MAX_PER_STAY = 10

export async function validateGuestToken(token: string): Promise<
  GuestActionResult<{ guest: Guest; roomNumber: string | null; expiresAt: string }>
> {
  if (!token) {
    return { success: false, error: 'Missing access token.' }
  }

  const admin = createAdminClient()
  const { data: guest, error } = await admin
    .from('guests')
    .select('*, rooms(number)')
    .eq('token', token)
    .maybeSingle()

  if (error || !guest) {
    return { success: false, error: 'Invalid or expired link.' }
  }

  if (guest.token_expires_at && new Date(guest.token_expires_at) <= new Date()) {
    return { success: false, error: 'expired' }
  }

  const expiresAt = guest.token_expires_at
    ? new Date(guest.token_expires_at)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const roomNumber =
    guest.rooms && typeof guest.rooms === 'object' && 'number' in guest.rooms
      ? (guest.rooms as { number: string }).number
      : null

  return {
    success: true,
    data: { guest: guest as Guest, roomNumber, expiresAt: expiresAt.toISOString() },
  }
}

export async function getGuestFromSession(): Promise<
  GuestActionResult<{ guest: Guest; roomNumber: string | null }>
> {
  const guestId = await getGuestSessionId()
  if (!guestId) {
    return { success: false, error: 'No active guest session.' }
  }

  const admin = createAdminClient()
  const { data: guest, error } = await admin
    .from('guests')
    .select('*, rooms(number)')
    .eq('id', guestId)
    .maybeSingle()

  if (error || !guest) {
    return { success: false, error: 'Session invalid.' }
  }

  if (guest.token_expires_at && new Date(guest.token_expires_at) <= new Date()) {
    return { success: false, error: 'expired' }
  }

  const roomNumber =
    guest.rooms && typeof guest.rooms === 'object' && 'number' in guest.rooms
      ? (guest.rooms as { number: string }).number
      : null

  return { success: true, data: { guest: guest as Guest, roomNumber } }
}

async function requireGuestSessionWithRules(): Promise<
  GuestActionResult<{ guest: Guest; roomNumber: string | null }>
> {
  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return {
      success: false,
      error: !session.success ? session.error : 'Not authorized.',
    }
  }

  if (await guestNeedsRulesAcceptance(session.data.guest.id)) {
    return { success: false, error: 'Please accept the property rules to continue.' }
  }

  return session
}

export async function submitGuestComplaint(
  input: unknown,
): Promise<GuestActionResult<{ reference: string; complaintId: string; hotelId: string }>> {
  const session = await requireGuestSessionWithRules()
  if (!session.success) {
    return { success: false, error: session.error ?? 'Not authorized.' }
  }
  if (!session.data) {
    return { success: false, error: 'Not authorized.' }
  }

  const parsed = submitComplaintSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid submission.' }
  }

  const { guest } = session.data
  const admin = createAdminClient()

  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const [{ count: totalCount }, { count: recentCount }] = await Promise.all([
    admin
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('guest_id', guest.id),
    admin
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('guest_id', guest.id)
      .gte('submitted_at', windowStart),
  ])

  if ((totalCount ?? 0) >= MAX_PER_STAY) {
    return { success: false, error: 'Please wait before submitting another complaint.' }
  }

  if ((recentCount ?? 0) >= MAX_PER_WINDOW) {
    return { success: false, error: 'Please wait before submitting another complaint.' }
  }

  const priority = parsed.data.priority === 'urgent' ? 'urgent' : 'medium'
  const { computeComplaintSlaDueAt } = await import('@/lib/complaints/sla')

  const { data: complaint, error } = await admin
    .from('complaints')
    .insert({
      hotel_id: guest.hotel_id,
      room_id: guest.room_id,
      guest_id: guest.id,
      category: parsed.data.category,
      description: parsed.data.description,
      priority,
      status: 'open',
      sla_due_at: computeComplaintSlaDueAt(priority),
    })
    .select('id')
    .single()

  if (error || !complaint) {
    return { success: false, error: 'Could not submit complaint. Try again.' }
  }

  void admin.from('complaint_events').insert({
    complaint_id: complaint.id,
    actor_role: 'guest',
    event_type: 'submitted',
    note: parsed.data.description.slice(0, 200),
  })

  const reference = complaint.id.slice(0, 8).toUpperCase()

  void import('@/lib/notifications/complaints').then(({ notifyComplaintSubmitted, notifyGuestComplaintReceived }) => {
    notifyComplaintSubmitted(complaint.id).catch(() => undefined)
    notifyGuestComplaintReceived(complaint.id).catch(() => undefined)
  })

  return {
    success: true,
    data: { reference, complaintId: complaint.id, hotelId: guest.hotel_id },
  }
}

export async function getGuestComplaints(): Promise<GuestActionResult<Complaint[]>> {
  const session = await getGuestFromSession()
  if (!session.success) {
    return { success: false, error: session.error ?? 'Not authorized.' }
  }
  if (!session.data) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('complaints')
    .select('*, rooms(number)')
    .eq('guest_id', session.data.guest.id)
    .order('submitted_at', { ascending: false })

  if (error) {
    return { success: false, error: 'Could not load complaints.' }
  }

  return { success: true, data: (data ?? []) as unknown as Complaint[] }
}

export async function getGuestComplaintActivity(
  complaintId: string,
): Promise<
  GuestActionResult<{ events: { id: string; label: string; createdAt: string }[] }>
> {
  const session = await requireGuestSessionWithRules()
  if (!session.success) {
    return { success: false, error: session.error ?? 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: complaint } = await admin
    .from('complaints')
    .select('id')
    .eq('id', complaintId)
    .eq('guest_id', session.data!.guest.id)
    .maybeSingle()

  if (!complaint) return { success: false, error: 'Issue not found.' }

  const { guestEventLabel, isGuestVisibleEvent } = await import('@/lib/complaints/guest-progress')

  const { data } = await admin
    .from('complaint_events')
    .select('id, event_type, created_at')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  const events = (data ?? [])
    .map((row) => {
      const label = guestEventLabel(row.event_type as import('@/types').ComplaintEventType)
      if (!label || !isGuestVisibleEvent(row.event_type as import('@/types').ComplaintEventType)) {
        return null
      }
      return {
        id: row.id,
        label,
        createdAt: row.created_at ?? new Date().toISOString(),
      }
    })
    .filter((e): e is { id: string; label: string; createdAt: string } => e !== null)

  return { success: true, data: { events } }
}

export async function approveGuestComplaintCompletion(
  complaintId: string,
): Promise<GuestActionResult> {
  const session = await requireGuestSessionWithRules()
  if (!session.success) {
    return { success: false, error: session.error ?? 'Not authorized.' }
  }
  if (!session.data) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: complaint } = await admin
    .from('complaints')
    .select('*')
    .eq('id', complaintId)
    .eq('guest_id', session.data.guest.id)
    .maybeSingle()

  if (!complaint || !canGuestApproveCompletion(complaint)) {
    return { success: false, error: 'This complaint is not ready for your approval.' }
  }

  const now = new Date().toISOString()

  const { error } = await admin
    .from('complaints')
    .update({
      status: 'resolved',
      approval_stage: null,
      guest_completion_approved_at: now,
      resolved_at: now,
      rejection_note: null,
    })
    .eq('id', complaintId)

  if (error) {
    return { success: false, error: 'Could not confirm completion. Try again.' }
  }

  await admin.from('complaint_events').insert({
    complaint_id: complaintId,
    actor_role: 'guest',
    event_type: 'guest_completion_approved',
  })

  void import('@/lib/notifications/complaints').then(({ notifyGuestApprovedCompletion }) =>
    notifyGuestApprovedCompletion(complaintId).catch(() => undefined),
  )

  return { success: true }
}

export interface EnrollRoomOption {
  id: string
  number: string
}

export type EnrollGuestResult =
  | { success: true; data: { token: string; loginUrl: string } }
  | { success: false; error: string; suggestions?: EnrollRoomOption[] }

export async function getEnrollmentRooms(): Promise<
  GuestActionResult<{
    rooms: EnrollRoomOption[]
    stays: { roomId: string; checkIn: string; checkOut: string }[]
  }>
> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authorized.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('hotel_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const [{ data: rooms }, spans] = await Promise.all([
    admin.from('rooms').select('id, number').eq('hotel_id', profile.hotel_id).order('number'),
    getOccupancySpans(admin, profile.hotel_id),
  ])

  return {
    success: true,
    data: {
      rooms: (rooms ?? []) as EnrollRoomOption[],
      stays: spans.map((s) => ({ roomId: s.roomId, checkIn: s.checkIn, checkOut: s.checkOut })),
    },
  }
}

export async function enrollGuest(input: {
  name: string
  phone: string
  email?: string
  roomId: string
  checkIn: string
  checkOut: string
}): Promise<EnrollGuestResult> {
  const result = await walkInCheckIn({
    name: input.name,
    phone: input.phone,
    email: input.email,
    roomId: input.roomId,
    checkOut: input.checkOut,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      suggestions: result.suggestions,
    }
  }

  if (!result.data) {
    return { success: false, error: 'Could not complete walk-in check-in.' }
  }

  return {
    success: true,
    data: { token: result.data.token, loginUrl: result.data.loginUrl },
  }
}

export async function checkOutGuest(input: {
  guestId: string
  paymentMethod: import('@/types').PaymentMethod
  earlyCheckout?: boolean
  markAsPaid?: boolean
}): Promise<GuestActionResult> {
  const result = await checkOutStay({
    guestId: input.guestId,
    paymentMethod: input.paymentMethod,
    earlyCheckout: input.earlyCheckout,
    markAsPaid: input.markAsPaid,
  })
  if (!result.success) return { success: false, error: result.error }
  return { success: true }
}

export async function updateGuest(input: {
  guestId: string
  name: string
  email?: string
  phone: string
}): Promise<GuestActionResult> {
  const { phoneSchema } = await import('@/lib/phone')
  const name = input.name.trim()
  if (name.length < 2) return { success: false, error: 'Name is required.' }
  const phoneParsed = phoneSchema.safeParse(input.phone)
  if (!phoneParsed.success) {
    return { success: false, error: phoneParsed.error.issues[0]?.message ?? 'Invalid phone.' }
  }

  const manager = await requireHotelManager()
  if (!manager?.hotel_id || !['owner', 'manager', 'receptionist'].includes(manager.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guests')
    .update({
      name,
      phone: phoneParsed.data,
      email: input.email?.trim() || null,
    })
    .eq('id', input.guestId)
    .eq('hotel_id', manager.hotel_id)

  if (error) return { success: false, error: error.message }

  const { revalidatePath } = await import('next/cache')
  revalidatePath('/manager/guests')
  revalidatePath('/owner/guests')
  return { success: true }
}

export async function updateGuestPhone(phone: string): Promise<GuestActionResult> {
  const { phoneSchema } = await import('@/lib/phone')
  const phoneParsed = phoneSchema.safeParse(phone)
  if (!phoneParsed.success) {
    return { success: false, error: phoneParsed.error.issues[0]?.message ?? 'Invalid phone.' }
  }

  const session = await requireGuestSessionWithRules()
  if (!session.success) {
    return { success: false, error: session.error ?? 'Not authorized.' }
  }
  if (!session.data) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guests')
    .update({ phone: phoneParsed.data })
    .eq('id', session.data.guest.id)

  if (error) return { success: false, error: error.message }

  return { success: true }
}

async function requireHotelManager(): Promise<{ hotel_id: string; role: string } | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('hotel_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) return null
  return { hotel_id: profile.hotel_id, role: profile.role }
}

function revalidateGuestViews(revalidatePath: (path: string) => void) {
  revalidatePath('/manager/guests')
  revalidatePath('/owner/guests')
}

/**
 * Revokes a guest's access link: clears the token (so the link no longer
 * matches any guest) and expires it immediately (so any already-open guest
 * session is cut off). Use when a stay ends early or access must be killed.
 */
export async function revokeGuestAccess(guestId: string): Promise<GuestActionResult> {
  const profile = await requireHotelManager()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('guests')
    .update({ token: null, token_expires_at: new Date().toISOString() })
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not revoke access.' }

  const { revalidatePath } = await import('next/cache')
  revalidateGuestViews(revalidatePath)
  return { success: true }
}

/**
 * Issues a fresh access link for a guest, valid until the end of their
 * checkout day. Replaces any existing (or revoked) token.
 */
export async function regenerateGuestAccess(
  guestId: string,
): Promise<GuestActionResult<{ token: string; tokenExpiresAt: string }>> {
  const profile = await requireHotelManager()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: guest } = await admin
    .from('guests')
    .select('check_out')
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!guest) return { success: false, error: 'Guest not found.' }

  const expires = guest.check_out
    ? new Date(guest.check_out)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  expires.setHours(23, 59, 59, 999)

  const token = crypto.randomUUID()
  const tokenExpiresAt = expires.toISOString()

  const { error } = await admin
    .from('guests')
    .update({ token, token_expires_at: tokenExpiresAt })
    .eq('id', guestId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: 'Could not regenerate link.' }

  const { revalidatePath } = await import('next/cache')
  revalidateGuestViews(revalidatePath)
  return { success: true, data: { token, tokenExpiresAt } }
}

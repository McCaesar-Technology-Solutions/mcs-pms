'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getGuestSessionId } from '@/lib/guest-session'
import { submitComplaintSchema } from '@/lib/validations'
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

export async function submitGuestComplaint(
  input: unknown,
): Promise<GuestActionResult<{ reference: string }>> {
  const session = await getGuestFromSession()
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

  const { count: totalCount } = await admin
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('guest_id', guest.id)

  if ((totalCount ?? 0) >= MAX_PER_STAY) {
    return { success: false, error: 'Please wait before submitting another complaint.' }
  }

  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count: recentCount } = await admin
    .from('complaints')
    .select('*', { count: 'exact', head: true })
    .eq('guest_id', guest.id)
    .gte('submitted_at', windowStart)

  if ((recentCount ?? 0) >= MAX_PER_WINDOW) {
    return { success: false, error: 'Please wait before submitting another complaint.' }
  }

  const priority = parsed.data.priority === 'urgent' ? 'urgent' : 'medium'

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
    })
    .select('id')
    .single()

  if (error || !complaint) {
    return { success: false, error: 'Could not submit complaint. Try again.' }
  }

  await admin.from('complaint_events').insert({
    complaint_id: complaint.id,
    actor_role: 'guest',
    event_type: 'submitted',
    note: parsed.data.description.slice(0, 200),
  })

  const reference = complaint.id.slice(0, 8).toUpperCase()
  return { success: true, data: { reference } }
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
    .select('*')
    .eq('guest_id', session.data.guest.id)
    .order('submitted_at', { ascending: false })

  if (error) {
    return { success: false, error: 'Could not load complaints.' }
  }

  return { success: true, data: (data ?? []) as Complaint[] }
}

export async function enrollGuest(input: {
  name: string
  phone?: string
  email?: string
  roomId: string
  checkIn: string
  checkOut: string
}): Promise<GuestActionResult<{ token: string; loginUrl: string }>> {
  const { enrollGuestSchema } = await import('@/lib/validations')
  const parsed = enrollGuestSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

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

  if (!profile?.hotel_id || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const checkOutDate = new Date(parsed.data.checkOut)
  checkOutDate.setHours(23, 59, 59, 999)

  const admin = createAdminClient()
  const { data: guest, error } = await admin
    .from('guests')
    .insert({
      hotel_id: profile.hotel_id,
      room_id: parsed.data.roomId,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      check_in: parsed.data.checkIn,
      check_out: parsed.data.checkOut,
      token_expires_at: checkOutDate.toISOString(),
      enrolled_by: user.id,
    })
    .select('token')
    .single()

  if (error || !guest) {
    return { success: false, error: 'Could not enroll guest.' }
  }

  let appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    const { headers } = await import('next/headers')
    const h = await headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'https'
    appUrl = host ? `${proto}://${host}` : 'http://localhost:3000'
  }
  const loginUrl = `${appUrl}/guest/enter?token=${guest.token}`

  return { success: true, data: { token: guest.token, loginUrl } }
}

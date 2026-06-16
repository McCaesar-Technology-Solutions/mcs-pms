'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { checkInStay } from '@/app/actions/stays'
import { findAvailableRooms, roomHasClash } from '@/lib/data/occupancy'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
import { getRoomRates } from '@/lib/pricing/room-rates'
import { createReservationSchema, updateReservationSchema } from '@/lib/validations'
import { phoneSchema } from '@/lib/phone'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PaymentMethod, ReservationChannel, ReservationStatus } from '@/types'

export type ReservationActionResult = { success: true } | { success: false; error: string }

export interface RoomSuggestion {
  id: string
  number: string
}

export type CreateReservationResult =
  | { success: true; id: string }
  | { success: false; error: string; suggestions?: RoomSuggestion[] }

export type BookAndCheckInResult =
  | {
      success: true
      data: { loginUrl: string; token: string; guestId: string; reservationId: string }
    }
  | { success: false; error: string; suggestions?: RoomSuggestion[] }

const bookAndCheckInSchema = createReservationSchema.extend({
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal('')),
})

const VALID_CHANNELS: ReservationChannel[] = [
  'airbnb',
  'booking_com',
  'direct',
  'walk_in',
  'other',
]

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, profile }
}

function revalidateReservationViews() {
  revalidatePath('/owner/reservations')
  revalidatePath('/manager/reservations')
  revalidatePath('/receptionist/reservations')
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
  revalidatePath('/receptionist/dashboard')
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
  revalidatePath('/owner/guests')
  revalidatePath('/manager/guests')
  revalidatePath('/receptionist/guests')
}

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'mtn_momo',
  'telecel_cash',
  'airteltigo',
  'visa',
  'mastercard',
  'cash',
  'bank_transfer',
]

export async function createReservation(input: unknown): Promise<CreateReservationResult> {
  const parsed = createReservationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const data = parsed.data
  if (data.checkOut <= data.checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  const rateType = data.rateType as RateType
  if (rateType === 'monthly' && (data.monthlyRate ?? 0) <= 0) {
    return { success: false, error: 'Enter a monthly rate.' }
  }

  if (await roomHasClash(supabase, profile.hotel_id, data.roomId, data.checkIn, data.checkOut)) {
    const suggestions = await findAvailableRooms(
      supabase,
      profile.hotel_id,
      data.checkIn,
      data.checkOut,
    )
    return {
      success: false,
      error: 'That room is already booked or occupied for these dates.',
      suggestions,
    }
  }

  const admin = createAdminClient()
  const roomRates = await getRoomRates(admin, data.roomId)
  const nightlyRate = rateType === 'nightly' ? data.nightlyRate : roomRates.nightlyRate
  const monthlyRate =
    rateType === 'monthly' ? (data.monthlyRate ?? roomRates.monthlyRate) : roomRates.monthlyRate

  const total = calculateStayTotal(rateType, data.checkIn, data.checkOut, nightlyRate, monthlyRate)

  const { data: row, error } = await supabase
    .from('reservations')
    .insert({
      hotel_id: profile.hotel_id,
      room_id: data.roomId,
      guest_id: data.guestId ?? null,
      guest_name: data.guestName.trim(),
      check_in: data.checkIn,
      check_out: data.checkOut,
      status: 'confirmed',
      channel: data.channel,
      rate_type: rateType,
      nightly_rate: nightlyRate,
      monthly_rate: monthlyRate,
      total_amount: total,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Could not create reservation.' }
  }

  revalidateReservationViews()
  return { success: true, id: row.id }
}

export async function bookAndCheckIn(input: unknown): Promise<BookAndCheckInResult> {
  const parsed = bookAndCheckInSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const createResult = await createReservation(parsed.data)
  if (!createResult.success) {
    return createResult
  }

  const checkInResult = await checkInStay(createResult.id, {
    phone: parsed.data.phone.trim(),
    email: parsed.data.email || undefined,
    guestId: parsed.data.guestId ?? undefined,
    guestName: parsed.data.guestName,
  })

  if (!checkInResult.success || !checkInResult.data) {
    const admin = createAdminClient()
    await admin.from('reservations').delete().eq('id', createResult.id)
    return {
      success: false,
      error: checkInResult.success ? 'Check-in failed.' : checkInResult.error,
    }
  }

  revalidateReservationViews()
  return {
    success: true,
    data: {
      ...checkInResult.data,
      reservationId: createResult.id,
    },
  }
}

export async function updateReservation(id: string, input: unknown): Promise<CreateReservationResult> {
  const parsed = updateReservationSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: existing } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Reservation not found.' }
  if (existing.status !== 'confirmed') {
    return { success: false, error: 'Only confirmed reservations can be edited.' }
  }

  const checkIn = parsed.data.checkIn ?? existing.check_in
  const checkOut = parsed.data.checkOut ?? existing.check_out
  const roomId = parsed.data.roomId ?? existing.room_id ?? undefined

  if (!roomId) return { success: false, error: 'Select a room.' }
  if (checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  const rateType = (parsed.data.rateType ?? existing.rate_type ?? 'nightly') as RateType
  const admin = createAdminClient()
  const roomRates = await getRoomRates(admin, roomId)

  const nightlyRate =
    parsed.data.nightlyRate ??
    (existing.nightly_rate != null ? Number(existing.nightly_rate) : roomRates.nightlyRate)
  const monthlyRate =
    parsed.data.monthlyRate ??
    (existing.monthly_rate != null ? Number(existing.monthly_rate) : roomRates.monthlyRate)

  if (rateType === 'monthly' && monthlyRate <= 0) {
    return { success: false, error: 'Enter a monthly rate.' }
  }

  if (
    await roomHasClash(supabase, profile.hotel_id, roomId, checkIn, checkOut, {
      excludeReservationId: id,
      excludeGuestId: existing.guest_id ?? undefined,
    })
  ) {
    const suggestions = await findAvailableRooms(supabase, profile.hotel_id, checkIn, checkOut, {
      excludeReservationId: id,
    })
    return {
      success: false,
      error: 'That room is already booked or occupied for these dates.',
      suggestions,
    }
  }

  const total = calculateStayTotal(rateType, checkIn, checkOut, nightlyRate, monthlyRate)

  const { error } = await supabase
    .from('reservations')
    .update({
      room_id: roomId,
      guest_name: parsed.data.guestName?.trim() ?? existing.guest_name,
      check_in: checkIn,
      check_out: checkOut,
      channel: (parsed.data.channel ?? existing.channel) as ReservationChannel,
      rate_type: rateType,
      nightly_rate: nightlyRate,
      monthly_rate: monthlyRate,
      total_amount: total,
    })
    .eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateReservationViews()
  return { success: true, id }
}

async function setReservationStatus(
  id: string,
  status: ReservationStatus,
  roomStatus?: 'occupied' | 'cleaning' | 'available',
): Promise<ReservationActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('room_id')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('reservations').update({ status }).eq('id', id)
  if (error) return { success: false, error: error.message }

  if (roomStatus && reservation?.room_id) {
    await supabase
      .from('rooms')
      .update({ status: roomStatus, updated_by: profile.id, updated_at: new Date().toISOString() })
      .eq('id', reservation.room_id)
  }

  revalidateReservationViews()
  return { success: true }
}

export async function checkOutReservation(
  id: string,
  paymentMethod: PaymentMethod = 'cash',
  earlyCheckout = false,
  markAsPaid = true,
): Promise<ReservationActionResult> {
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' }
  }
  const { checkOutStay } = await import('@/app/actions/stays')
  const result = await checkOutStay({ reservationId: id, paymentMethod, earlyCheckout, markAsPaid })
  if (!result.success) return { success: false, error: result.error }
  return { success: true }
}

export async function cancelReservation(id: string): Promise<ReservationActionResult> {
  return setReservationStatus(id, 'cancelled')
}

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
import { writeAuditLog, moneyDelta } from '@/lib/audit/log'
import { validateReservationCancellation } from '@/lib/reservations/cancel-eligibility'
import {
  applyDepositDisposition,
  type DepositDisposition,
  requiresDepositDisposition,
  validateDepositDispositionInput,
} from '@/lib/billing/deposit-disposition'
import {
  derivePreCheckoutPaymentStatus,
  refreshPreCheckoutPaymentStatus,
  reservationBalanceDue,
} from '@/lib/billing/reservation-payment'
import { todayISO } from '@/lib/stays/helpers'
import { revalidateStayViews } from '@/lib/stays/revalidate'
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
    .select('id, role, hotel_id, name')
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
      payment_status: 'unpaid',
      amount_paid: 0,
      deposit_amount: 0,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Could not create reservation.' }
  }

  void (async () => {
    const admin = createAdminClient()
    const { data: room } = await admin.from('rooms').select('number').eq('id', data.roomId).maybeSingle()
    await writeAuditLog({
      hotelId: profile.hotel_id!,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'reservation',
      entityId: row.id,
      action: 'created',
      summary: `Booking for ${data.guestName.trim()}${room?.number ? ` — Room ${room.number}` : ''} (${data.checkIn} → ${data.checkOut}, ${data.channel})`,
    })
  })()

  void import('@/lib/notifications/stays').then(async ({ notifyManagersNewReservation }) => {
    const admin = createAdminClient()
    const { data: room } = await admin.from('rooms').select('number').eq('id', data.roomId).maybeSingle()
    await notifyManagersNewReservation({
      hotelId: profile.hotel_id!,
      guestName: data.guestName,
      roomNumber: room?.number ?? null,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      channel: data.channel,
    })
  }).catch(() => undefined)

  if (data.guestId) {
    void import('@/lib/notifications/stays').then(async ({ notifyGuestReservationConfirmed }) => {
      const admin = createAdminClient()
      const { data: guest } = await admin
        .from('guests')
        .select('phone')
        .eq('id', data.guestId!)
        .maybeSingle()
      const { data: room } = await admin.from('rooms').select('number').eq('id', data.roomId).maybeSingle()
      const phone = guest?.phone?.trim()
      if (!phone) return
      await notifyGuestReservationConfirmed({
        hotelId: profile.hotel_id!,
        phone,
        guestName: data.guestName,
        roomNumber: room?.number ?? null,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
      })
    }).catch(() => undefined)
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

  await refreshPreCheckoutPaymentStatus(admin, id)

  const guestName = parsed.data.guestName?.trim() ?? existing.guest_name
  const changes: string[] = []
  if (existing.guest_name !== guestName) changes.push(`Guest: ${existing.guest_name} → ${guestName}`)
  if (existing.check_in !== checkIn || existing.check_out !== checkOut) {
    changes.push(`Dates: ${existing.check_in}–${existing.check_out} → ${checkIn}–${checkOut}`)
  }
  if (existing.room_id !== roomId) changes.push('Room changed')
  const nightlyDelta = moneyDelta('Nightly rate', existing.nightly_rate, nightlyRate)
  if (nightlyDelta) changes.push(nightlyDelta)
  const monthlyDelta = moneyDelta('Monthly rate', existing.monthly_rate, monthlyRate)
  if (monthlyDelta) changes.push(monthlyDelta)
  if ((existing.rate_type ?? 'nightly') !== rateType) {
    changes.push(`Rate type: ${existing.rate_type ?? 'nightly'} → ${rateType}`)
  }
  const totalDelta = moneyDelta('Total', existing.total_amount, total)
  if (totalDelta) changes.push(totalDelta)

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: id,
    action: 'updated',
    summary:
      changes.length > 0
        ? `Reservation for ${guestName}: ${changes.join('; ')}`
        : `Reservation updated for ${guestName}`,
    details: {
      before: {
        guestName: existing.guest_name,
        checkIn: existing.check_in,
        checkOut: existing.check_out,
        roomId: existing.room_id,
        nightlyRate: existing.nightly_rate,
        monthlyRate: existing.monthly_rate,
        rateType: existing.rate_type,
        total: existing.total_amount,
      },
      after: {
        guestName,
        checkIn,
        checkOut,
        roomId,
        nightlyRate,
        monthlyRate,
        rateType,
        total,
      },
    },
  })

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
  includeTax = true,
): Promise<ReservationActionResult> {
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' }
  }
  const { checkOutStay } = await import('@/app/actions/stays')
  const result = await checkOutStay({
    reservationId: id,
    paymentMethod,
    earlyCheckout,
    markAsPaid,
    includeTax,
  })
  if (!result.success) return { success: false, error: result.error }
  return { success: true }
}

export async function cancelReservation(
  id: string,
  options?: { depositDisposition?: DepositDisposition },
): Promise<ReservationActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select(
      'hotel_id, guest_name, check_in, check_out, status, guest_id, room_id, amount_paid, guests(phone)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }

  const admin = createAdminClient()
  const eligibility = await validateReservationCancellation(admin, {
    id,
    status: reservation.status,
    guest_id: reservation.guest_id,
    hotel_id: reservation.hotel_id,
  })
  if (!eligibility.ok) return { success: false, error: eligibility.error }

  const amountPaid = Number(reservation.amount_paid ?? 0)
  const depositCheck = validateDepositDispositionInput(
    amountPaid,
    options?.depositDisposition,
    profile.role,
  )
  if (!depositCheck.ok) return { success: false, error: depositCheck.error }

  if (requiresDepositDisposition(amountPaid) && options?.depositDisposition) {
    const applied = await applyDepositDisposition(admin, {
      hotelId: reservation.hotel_id,
      reservationId: id,
      guestId: reservation.guest_id,
      guestName: reservation.guest_name,
      amountPaid,
      disposition: options.depositDisposition,
      reason: 'cancelled',
      actorId: profile.id,
      actorName: profile.name ?? 'Staff',
    })
    if (!applied.ok) return { success: false, error: applied.error }
  }

  const result = await setReservationStatus(id, 'cancelled')
  if (!result.success) return result

  const today = todayISO()
  const now = new Date().toISOString()

  if (reservation.guest_id) {
    const endedCheckOut =
      reservation.check_in > today ? reservation.check_in : today

    await admin
      .from('guests')
      .update({
        room_id: null,
        check_out: endedCheckOut,
        token: null,
        token_expires_at: now,
      })
      .eq('id', reservation.guest_id)
      .eq('hotel_id', reservation.hotel_id)
  }

  revalidateStayViews()

  void writeAuditLog({
    hotelId: profile.hotel_id!,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: id,
    action: 'cancelled',
    summary: `Cancelled booking for ${reservation.guest_name} (${reservation.check_in} → ${reservation.check_out})`,
  })

  const guest = reservation.guests as { phone?: string | null } | null
  const phone = guest?.phone?.trim()
  if (phone && reservation.guest_id) {
    void import('@/lib/notifications/stays').then(({ notifyGuestReservationCancelled }) =>
      notifyGuestReservationCancelled({
        hotelId: reservation.hotel_id,
        phone,
        guestName: reservation.guest_name,
        checkIn: reservation.check_in,
        checkOut: reservation.check_out,
      }).catch(() => undefined),
    )
  }

  return { success: true }
}

const depositSchema = z.object({
  reservationId: z.string().uuid(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum([
    'mtn_momo',
    'telecel_cash',
    'airteltigo',
    'visa',
    'mastercard',
    'cash',
    'bank_transfer',
  ]),
  reference: z.string().max(120).optional(),
})

export async function recordReservationDeposit(input: unknown): Promise<ReservationActionResult> {
  const parsed = depositSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid deposit.' }
  }

  const { profile } = await requireManager()
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, guest_id, guest_name, status, total_amount, amount_paid')
    .eq('id', parsed.data.reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'confirmed' && reservation.status !== 'checked_in') {
    return { success: false, error: 'Deposits can only be recorded before check-out.' }
  }

  const total = Number(reservation.total_amount ?? 0)
  const currentPaid = Number(reservation.amount_paid ?? 0)
  const balance = reservationBalanceDue(total, currentPaid)
  if (parsed.data.amount > balance + 0.009) {
    return { success: false, error: `Deposit exceeds balance due (₵${balance}).` }
  }

  const newPaid = Math.round((currentPaid + parsed.data.amount) * 100) / 100
  const now = new Date().toISOString()
  const idempotencyKey = parsed.data.reference
    ? `deposit:${parsed.data.reservationId}:${parsed.data.reference}`
    : `deposit:${parsed.data.reservationId}:${now}`

  const { data: existingPayment } = await admin
    .from('payment_records')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingPayment) {
    return { success: true }
  }

  await admin.from('payment_records').insert({
    hotel_id: profile.hotel_id,
    reservation_id: reservation.id,
    guest_id: reservation.guest_id,
    provider: 'manual',
    provider_reference: parsed.data.reference ?? null,
    amount: parsed.data.amount,
    currency: 'GHS',
    status: 'success',
    idempotency_key: idempotencyKey,
    completed_at: now,
    metadata: { type: 'deposit' },
  })

  await admin
    .from('reservations')
    .update({
      amount_paid: newPaid,
      payment_method: parsed.data.paymentMethod,
      payment_status: derivePreCheckoutPaymentStatus(total, newPaid),
    })
    .eq('id', reservation.id)

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'deposit',
    summary: `Deposit ₵${parsed.data.amount} on ${reservation.guest_name} booking`,
  })

  revalidateReservationViews()
  return { success: true }
}

const channelPrepaidSchema = z.object({
  reservationId: z.string().uuid(),
  paymentMethod: z
    .enum([
      'mtn_momo',
      'telecel_cash',
      'airteltigo',
      'visa',
      'mastercard',
      'cash',
      'bank_transfer',
    ])
    .default('bank_transfer'),
})

export async function markChannelPrepaid(input: unknown): Promise<ReservationActionResult> {
  const parsed = channelPrepaidSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { profile } = await requireManager()
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, guest_id, guest_name, status, channel, total_amount, amount_paid')
    .eq('id', parsed.data.reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'confirmed' && reservation.status !== 'checked_in') {
    return { success: false, error: 'Channel prepayment applies before check-out.' }
  }
  if (reservation.channel !== 'airbnb' && reservation.channel !== 'booking_com') {
    return { success: false, error: 'Use deposits for direct and walk-in bookings.' }
  }

  const total = Number(reservation.total_amount ?? 0)
  const balance = reservationBalanceDue(total, Number(reservation.amount_paid ?? 0))
  if (balance <= 0) return { success: true }

  return recordReservationDeposit({
    reservationId: parsed.data.reservationId,
    amount: balance,
    paymentMethod: parsed.data.paymentMethod,
    reference: `channel:${reservation.channel}`,
  })
}

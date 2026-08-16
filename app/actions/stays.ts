'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeInvoiceTaxes, noTaxInvoice, taxSnapshotFromRates } from '@/lib/tax'
import { resolveInvoiceTaxId } from '@/lib/billing/ghana-card'
import {
  guestIdDocumentColumns,
  guestIdDocumentFieldShape,
  guestIdDocumentFromRow,
  guestIdDocumentHasValue,
  parseGuestIdDocumentFields,
  refineGuestIdDocumentFields,
  type GuestIdDocumentType,
} from '@/lib/guests/id-document'
import { getHotelTaxConfig } from '@/lib/data/settings'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import { createOrRefreshStayInvoice } from '@/lib/billing/build-stay-invoice'
import { resolveBillToName } from '@/lib/billing/bill-to'
import { createPostCheckoutCleanTask } from '@/lib/housekeeping/checkout-task'
import { phoneSchema } from '@/lib/phone'
import { generatePortalPin } from '@/lib/guest/portal-pin'
import { storeGuestPortalPin } from '@/lib/data/guest-room-access'
import {
  provisionGuestAccess,
  revokeGuestAccess,
  updateGuestAccessValidity,
  rematerializeGuestAccessForRoomMove,
} from '@/lib/access/lifecycle'
import { findAvailableRooms, roomHasClash } from '@/lib/data/occupancy'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
import { getRoomRates } from '@/lib/pricing/room-rates'
import {
  buildGuestLoginUrl,
  stayNights,
  todayISO,
  tokenExpiryISO,
} from '@/lib/stays/helpers'
import { addDaysISO, hotelTodayISO, normalizeHotelTimezone } from '@/lib/hotel-time'
import { revalidateStayViews } from '@/lib/stays/revalidate'
import {
  linkFolioChargesToInvoice,
  prepareCheckoutTaxesWithFolio,
} from '@/lib/folio/rollup'
import { writeAuditLog, logRoomStatusChange } from '@/lib/audit/log'
import { canCheckIn, canCheckOut, canStartDisputeHold, parseRequiredStayNote, OCCUPYING_STATUSES, statusAfterDisputeHoldRelease } from '@/lib/reservations/lifecycle'
import { validateCheckoutBalance } from '@/lib/reservations/checkout-validation'
import { runNotifyTask } from '@/lib/notifications/notify-task'
import {
  buildCheckoutInvoicePaymentState,
  finalizeReservationCheckoutPayment,
  refreshPreCheckoutPaymentStatus,
} from '@/lib/billing/reservation-payment'
import { appendReservationEvent, transitionReservation } from '@/lib/reservations/state-machine'
import { normalizeActorRole } from '@/lib/reservations/transitions'
import type { InvoiceExportRow } from '@/lib/export/types'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import type { PaymentMethod, ReservationChannel } from '@/types'
import { z } from 'zod'

export type StayActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; suggestions?: { id: string; number: string }[] }

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'mtn_momo',
  'telecel_cash',
  'airteltigo',
  'visa',
  'mastercard',
  'cash',
  'bank_transfer',
]

const checkInStaySchema = z.object({
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal('')),
  guestId: z.string().uuid().optional(),
  guestName: z.string().min(2).optional(),
  ...guestIdDocumentFieldShape,
  /** Optional GRA tax on the stay invoice created at check-in (default off). */
  includeTax: z.boolean().optional(),
  billToSameAsGuest: z.boolean().optional(),
  billToName: z.string().max(120).optional().or(z.literal('')),
}).superRefine(refineGuestIdDocumentFields)

const walkInCheckInSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal('')),
  ...guestIdDocumentFieldShape,
  roomId: z.string().uuid(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rateType: z.enum(['nightly', 'weekly', 'monthly']).optional(),
  nightlyRate: z.coerce.number().min(0).optional(),
  weeklyRate: z.coerce.number().min(0).optional(),
  monthlyRate: z.coerce.number().min(0).optional(),
  includeTax: z.boolean().optional(),
  billToSameAsGuest: z.boolean().optional(),
  billToName: z.string().max(120).optional().or(z.literal('')),
}).superRefine(refineGuestIdDocumentFields)

async function requireManager() {
  const result = await requireVerifiedStaff()
  if (!result.ok) return { supabase: result.supabase, profile: null, userId: null }
  return { supabase: result.supabase, profile: result.profile, userId: result.userId }
}

async function getRoomNightlyRate(
  admin: ReturnType<typeof createAdminClient>,
  roomId: string,
): Promise<number> {
  const { data } = await admin
    .from('rooms')
    .select('nightly_rate, room_categories(default_nightly_rate)')
    .eq('id', roomId)
    .maybeSingle()

  if (data?.nightly_rate != null) return Number(data.nightly_rate)
  const cat = data?.room_categories as { default_nightly_rate?: number } | null
  return Number(cat?.default_nightly_rate ?? 0)
}

async function computeCheckoutTaxes(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  checkIn: string,
  effectiveCheckOut: string,
  roomId: string | null | undefined,
  rateTypeInput?: string | null,
  nightlyRateInput?: number | null,
  monthlyRateInput?: number | null,
  totalAmountInput?: number | null,
  plannedCheckOut?: string | null,
  includeTax = false,
  weeklyRateInput?: number | null,
) {
  const { vatMode, rates } = await getHotelTaxConfig(hotelId)

  let chargeAmount = 0
  if (
    totalAmountInput != null &&
    plannedCheckOut &&
    effectiveCheckOut === plannedCheckOut
  ) {
    chargeAmount = Number(totalAmountInput)
  } else if (roomId) {
    const rateType = (rateTypeInput ?? 'nightly') as RateType
    const roomRates = await getRoomRates(admin, roomId)
    const nightlyRate =
      nightlyRateInput != null ? Number(nightlyRateInput) : roomRates.nightlyRate
    const weeklyRate =
      weeklyRateInput != null ? Number(weeklyRateInput) : roomRates.weeklyRate
    const monthlyRate =
      monthlyRateInput != null ? Number(monthlyRateInput) : roomRates.monthlyRate
    chargeAmount = calculateStayTotal(
      rateType,
      checkIn,
      effectiveCheckOut,
      nightlyRate,
      monthlyRate,
      weeklyRate,
    )
  }

  const taxes = includeTax
    ? computeInvoiceTaxes(chargeAmount, vatMode, rates)
    : noTaxInvoice(chargeAmount)
  return { chargeAmount, taxes, vatMode, rates }
}

async function findInHouseGuestByPhone(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  phone: string,
  excludeGuestId?: string,
): Promise<string | null> {
  const digits = phone.replace(/\D/g, '')
  const { data: guests } = await admin
    .from('guests')
    .select('id, phone, check_in, check_out')
    .eq('hotel_id', hotelId)

  const today = todayISO()
  for (const g of guests ?? []) {
    if (excludeGuestId && g.id === excludeGuestId) continue
    if (!g.phone || g.phone.replace(/\D/g, '') !== digits) continue
    if (g.check_in && g.check_out && g.check_in <= today && g.check_out >= today) {
      const { data: activeRes } = await admin
        .from('reservations')
        .select('id')
        .eq('guest_id', g.id)
        .in('status', [...OCCUPYING_STATUSES])
        .maybeSingle()
      if (activeRes) return g.id
    }
  }
  return null
}

export async function searchGuests(query: string): Promise<
  StayActionResult<{
    id: string
    name: string
    phone: string | null
    email: string | null
    idDocumentType: GuestIdDocumentType | null
    idDocumentNumber: string | null
    idDocumentCountry: string | null
    ghanaCardNumber: string | null
  }[]>
> {
  const { profile } = await requireManager()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const q = query.trim().replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (q.length < 2) return { success: true, data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('guests')
    .select('id, name, phone, email, ghana_card_number, id_document_type, id_document_number, id_document_country')
    .eq('hotel_id', profile.hotel_id)
    .or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,ghana_card_number.ilike.%${q}%,id_document_number.ilike.%${q}%`,
    )
    .order('name')
    .limit(8)

  if (error) return { success: false, error: error.message }
  return {
    success: true,
    data: (data ?? []).map((g) => {
      const doc = guestIdDocumentFromRow(g)
      return {
        id: g.id,
        name: g.name,
        phone: g.phone,
        email: g.email,
        idDocumentType: doc.type,
        idDocumentNumber: doc.number,
        idDocumentCountry: doc.country,
        ghanaCardNumber: doc.type === 'ghana_card' ? doc.number : null,
      }
    }),
  }
}

export async function checkInStay(
  reservationId: string,
  input: {
    phone: string
    email?: string
    guestId?: string
    guestName?: string
    idDocumentType?: 'ghana_card' | 'passport' | 'drivers_license' | null
    idDocumentNumber?: string
    idDocumentCountry?: string
    includeTax?: boolean
    billToSameAsGuest?: boolean
    billToName?: string
  },
  opts?: { quiet?: boolean },
): Promise<
  StayActionResult<{
    loginUrl: string
    token: string
    guestId: string
    portalPin: string
    invoiceId: string | null
    invoicePreview?: InvoiceExportRow
    invoiceError?: string
  }>
> {
  const parsed = checkInStaySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }
  const idParsed = parseGuestIdDocumentFields(parsed.data)
  if (!idParsed.ok) return { success: false, error: idParsed.error }
  const idPatch = guestIdDocumentHasValue(idParsed.value)
    ? guestIdDocumentColumns(idParsed.value)
    : {}

  const { supabase, profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (!canCheckIn(reservation.status)) {
    return { success: false, error: 'Only confirmed or pre-arrival reservations can be checked in.' }
  }
  if (!reservation.room_id) return { success: false, error: 'Reservation has no room assigned.' }

  if (
    await roomHasClash(
      admin,
      profile.hotel_id,
      reservation.room_id,
      reservation.check_in,
      reservation.check_out,
      { excludeReservationId: reservationId },
    )
  ) {
    const suggestions = await findAvailableRooms(
      admin,
      profile.hotel_id,
      reservation.check_in,
      reservation.check_out,
      { excludeReservationId: reservationId },
    )
    return {
      success: false,
      error: 'That room is already occupied for these dates.',
      suggestions,
    }
  }

  const duplicateGuest = await findInHouseGuestByPhone(
    admin,
    profile.hotel_id,
    parsed.data.phone,
    parsed.data.guestId,
  )
  if (duplicateGuest) {
    return {
      success: false,
      error: 'Another guest with this phone is already checked in. Use a different contact or check them out first.',
    }
  }

  const guestName = parsed.data.guestName?.trim() || reservation.guest_name
  const token = crypto.randomUUID()
  const tokenExpiresAt = tokenExpiryISO(reservation.check_out)
  const portalPin = generatePortalPin()

  let guestId = parsed.data.guestId ?? reservation.guest_id ?? null
  let guestWasCreated = false
  let guestSnapshot: {
    name: string
    phone: string | null
    email: string | null
    room_id: string | null
    check_in: string | null
    check_out: string | null
    token: string | null
    token_expires_at: string | null
  } | null = null

  if (guestId) {
    const { data: existing } = await admin
      .from('guests')
      .select('id, name, phone, email, room_id, check_in, check_out, token, token_expires_at')
      .eq('id', guestId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()
    if (!existing) return { success: false, error: 'Guest not found.' }
    guestSnapshot = {
      name: existing.name,
      phone: existing.phone,
      email: existing.email,
      room_id: existing.room_id,
      check_in: existing.check_in,
      check_out: existing.check_out,
      token: existing.token,
      token_expires_at: existing.token_expires_at,
    }

    const { error: guestError } = await admin
      .from('guests')
      .update({
        name: guestName,
        phone: parsed.data.phone.trim(),
        email: parsed.data.email || null,
        ...idPatch,
        room_id: reservation.room_id,
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        token,
        token_expires_at: tokenExpiresAt,
      })
      .eq('id', guestId)

    if (guestError) return { success: false, error: guestError.message }
    await storeGuestPortalPin(guestId, portalPin)
  } else {
    const { data: newGuest, error: guestError } = await admin
      .from('guests')
      .insert({
        hotel_id: profile.hotel_id,
        room_id: reservation.room_id,
        name: guestName,
        phone: parsed.data.phone.trim(),
        email: parsed.data.email || null,
        ...guestIdDocumentColumns(idParsed.value),
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        token,
        token_expires_at: tokenExpiresAt,
        enrolled_by: userId,
      })
      .select('id')
      .single()

    if (guestError || !newGuest) return { success: false, error: 'Could not create guest record.' }
    guestId = newGuest.id
    guestWasCreated = true
    await storeGuestPortalPin(guestId, portalPin)
  }

  const { error: resError } = await admin
    .from('reservations')
    .update({
      guest_id: guestId,
      guest_name: guestName,
    })
    .eq('id', reservationId)

  if (resError) return { success: false, error: resError.message }

  const { data: roomBeforeCheckIn } = await admin
    .from('rooms')
    .select('number, status')
    .eq('id', reservation.room_id)
    .maybeSingle()

  const transition = await transitionReservation({
    reservationId,
    hotelId: profile.hotel_id,
    toStatus: 'checked_in',
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
    payload: {
      guestPhone: parsed.data.phone.trim(),
      roomNumber: roomBeforeCheckIn?.number ?? null,
      portalToken: token,
      ...(opts?.quiet ? { suppressGuestNotify: true } : {}),
    },
  })
  if (!transition.success) {
    if (guestWasCreated && guestId) {
      await admin.from('guests').delete().eq('id', guestId)
    } else if (guestId && guestSnapshot) {
      await admin
        .from('guests')
        .update({
          name: guestSnapshot.name,
          phone: guestSnapshot.phone,
          email: guestSnapshot.email,
          room_id: guestSnapshot.room_id,
          check_in: guestSnapshot.check_in,
          check_out: guestSnapshot.check_out,
          token: guestSnapshot.token,
          token_expires_at: guestSnapshot.token_expires_at,
        })
        .eq('id', guestId)
    }
    if (guestWasCreated) {
      await admin
        .from('reservations')
        .update({ guest_id: reservation.guest_id })
        .eq('id', reservationId)
    }
    return { success: false, error: transition.error ?? 'Check-in failed.' }
  }

  const loginUrl = await buildGuestLoginUrl(token)

  const roomRow = roomBeforeCheckIn

  if (roomBeforeCheckIn && roomBeforeCheckIn.status !== 'occupied') {
    void logRoomStatusChange({
      hotelId: profile.hotel_id,
      actorId: userId,
      actorName: profile.name,
      roomId: reservation.room_id,
      roomNumber: roomBeforeCheckIn.number,
      from: roomBeforeCheckIn.status ?? 'available',
      to: 'occupied',
      reason: 'check-in',
    })
  }

  revalidateStayViews()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'checked_in',
    summary: opts?.quiet
      ? `${guestName} registered in house${roomRow?.number ? ` — Room ${roomRow.number}` : ''} (${reservation.check_in} → ${reservation.check_out})`
      : `${guestName} checked in${roomRow?.number ? ` — Room ${roomRow.number}` : ''} (${reservation.check_in} → ${reservation.check_out})`,
  })

  void provisionGuestAccess({
    hotelId: profile.hotel_id,
    guestId,
    reservationId,
    roomId: reservation.room_id,
    guestName,
    checkIn: reservation.check_in,
    checkOut: reservation.check_out,
    doorPin: portalPin,
  })

  // Pay-before-enter: create the stay invoice at check-in (pending). Checkout reuses it.
  let invoiceId: string | null = null
  let invoicePreview: InvoiceExportRow | undefined
  let invoiceError: string | undefined
  const paymentMethod = (
    reservation.payment_method &&
    ['mtn_momo', 'telecel_cash', 'airteltigo', 'visa', 'mastercard', 'cash', 'bank_transfer'].includes(
      reservation.payment_method,
    )
      ? reservation.payment_method
      : 'cash'
  ) as PaymentMethod

  try {
    const issued = await createOrRefreshStayInvoice(admin, {
      reservation: {
        ...reservation,
        guest_id: guestId,
        guest_name: guestName,
      },
      paymentMethod,
      markAsPaid: false,
      includeTax: parsed.data.includeTax === true,
      guestPhone: parsed.data.phone.trim(),
      roomNumber: roomRow?.number ?? null,
      billToSameAsGuest: parsed.data.billToSameAsGuest,
      billToName: parsed.data.billToName,
    })
    invoiceId = issued.invoiceId
    invoicePreview = issued.invoicePreview
    // Ensure Billing / reservation lists pick up the new stay invoice.
    revalidateStayViews()
  } catch (err) {
    invoiceError = err instanceof Error ? err.message : 'Could not create stay invoice.'
    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: userId,
      actorName: profile.name,
      entityType: 'reservation',
      entityId: reservationId,
      action: 'invoice_failed',
      summary: `Check-in invoice failed for ${guestName}: ${invoiceError}`,
    })
  }

  return {
    success: true,
    data: { loginUrl, token, guestId, portalPin, invoiceId, invoicePreview, invoiceError },
  }
}

export async function walkInCheckIn(input: unknown): Promise<
  StayActionResult<{
    loginUrl: string
    token: string
    reservationId: string
    guestId: string
    portalPin: string
  }>
> {
  const parsed = walkInCheckInSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid walk-in check-in details.',
    }
  }

  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const checkIn = todayISO()
  if (parsed.data.checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be a future date.' }
  }

  const admin = createAdminClient()

  if (await roomHasClash(admin, profile.hotel_id, parsed.data.roomId, checkIn, parsed.data.checkOut)) {
    const suggestions = await findAvailableRooms(admin, profile.hotel_id, checkIn, parsed.data.checkOut)
    return {
      success: false,
      error: 'That room is already occupied for these dates.',
      suggestions,
    }
  }

  const rateType = parsed.data.rateType ?? 'nightly'
  if (rateType === 'weekly' && (parsed.data.weeklyRate ?? 0) <= 0) {
    return { success: false, error: 'Enter a weekly rate.' }
  }
  if (rateType === 'monthly' && (parsed.data.monthlyRate ?? 0) <= 0) {
    return { success: false, error: 'Enter a monthly rate.' }
  }
  const roomRates = await getRoomRates(admin, parsed.data.roomId)
  const nightlyRate =
    rateType === 'nightly' ? (parsed.data.nightlyRate ?? roomRates.nightlyRate) : roomRates.nightlyRate
  const weeklyRate =
    rateType === 'weekly' ? (parsed.data.weeklyRate ?? roomRates.weeklyRate) : roomRates.weeklyRate
  const monthlyRate =
    rateType === 'monthly' ? (parsed.data.monthlyRate ?? roomRates.monthlyRate) : roomRates.monthlyRate
  const total = calculateStayTotal(
    rateType,
    checkIn,
    parsed.data.checkOut,
    nightlyRate,
    monthlyRate,
    weeklyRate,
  )

  const { data: reservation, error: resError } = await admin
    .from('reservations')
    .insert({
      hotel_id: profile.hotel_id,
      room_id: parsed.data.roomId,
      guest_name: parsed.data.name.trim(),
      check_in: checkIn,
      check_out: parsed.data.checkOut,
      status: 'inquiry',
      channel: 'walk_in' as ReservationChannel,
      rate_type: rateType,
      nightly_rate: nightlyRate,
      weekly_rate: weeklyRate,
      monthly_rate: monthlyRate,
      total_amount: total,
      created_by: userId,
    })
    .select('id')
    .single()

  if (resError || !reservation) {
    return { success: false, error: resError?.message ?? 'Could not create stay.' }
  }

  const confirmed = await transitionReservation({
    reservationId: reservation.id,
    hotelId: profile.hotel_id,
    toStatus: 'confirmed',
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
    payload: { walkIn: true },
  })
  if (!confirmed.success) {
    await admin.from('reservations').delete().eq('id', reservation.id)
    if (confirmed.code === 'ROOM_CONFLICT') {
      const suggestions = await findAvailableRooms(admin, profile.hotel_id, checkIn, parsed.data.checkOut)
      return {
        success: false,
        error: 'That room was just booked for these dates. Pick another room.',
        suggestions,
      }
    }
    return { success: false, error: confirmed.error ?? 'Could not confirm walk-in stay.' }
  }

  const { data: walkInRoom } = await admin
    .from('rooms')
    .select('number')
    .eq('id', parsed.data.roomId)
    .maybeSingle()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'created',
    summary: `Walk-in booking for ${parsed.data.name.trim()}${walkInRoom?.number ? ` — Room ${walkInRoom.number}` : ''} (${checkIn} → ${parsed.data.checkOut})`,
  })

  const checkInResult = await checkInStay(reservation.id, {
    phone: parsed.data.phone,
    email: parsed.data.email,
    guestName: parsed.data.name.trim(),
    idDocumentType: parsed.data.idDocumentType,
    idDocumentNumber: parsed.data.idDocumentNumber,
    idDocumentCountry: parsed.data.idDocumentCountry,
    includeTax: parsed.data.includeTax === true,
    billToSameAsGuest: parsed.data.billToSameAsGuest,
    billToName: parsed.data.billToName,
  })

  if (!checkInResult.success || !checkInResult.data) {
    await admin.from('reservations').delete().eq('id', reservation.id)
    return {
      success: false,
      error: checkInResult.success ? 'Check-in failed.' : checkInResult.error,
    }
  }

  return {
    success: true,
    data: {
      ...checkInResult.data,
      reservationId: reservation.id,
    },
  }
}

type StayDepartureStatus = 'checked_out' | 'walkout'

async function executeStayCheckout(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    reservation: {
      id: string
      hotel_id: string
      room_id: string | null
      guest_id: string | null
      guest_name: string
      nightly_rate: number | null
      weekly_rate: number | null
      monthly_rate: number | null
      rate_type: string | null
      total_amount: number | null
      amount_paid: number | null
      check_in: string
      check_out: string
      status: string | null
    }
    profile: { hotel_id: string; id: string; name: string | null; role: string }
    userId: string
    paymentMethod: PaymentMethod
    earlyCheckout?: boolean
    markAsPaid?: boolean
    includeTax: boolean
    billToSameAsGuest?: boolean
    billToName?: string | null
    departureStatus: StayDepartureStatus
  },
): Promise<StayActionResult<{ invoiceId: string | null; invoicePreview?: InvoiceExportRow }>> {
  const { reservation, profile, userId } = input
  const today = todayISO()
  const actorRole = normalizeActorRole(profile.role)
  const isWalkout = input.departureStatus === 'walkout'
  const paidNow = !isWalkout && input.markAsPaid !== false

  let guestPhone: string | null = null
  let roomNumber: string | null = null
  if (reservation.guest_id) {
    const { data: guestRow } = await admin
      .from('guests')
      .select('phone')
      .eq('id', reservation.guest_id)
      .maybeSingle()
    guestPhone = guestRow?.phone?.trim() ?? null
  }
  if (reservation.room_id) {
    const { data: roomRow } = await admin
      .from('rooms')
      .select('number')
      .eq('id', reservation.room_id)
      .maybeSingle()
    roomNumber = roomRow?.number ?? null
  }

  const effectiveCheckOut = input.earlyCheckout ? today : reservation.check_out
  if (effectiveCheckOut <= reservation.check_in) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  let invoiceId: string | null = null
  let invoicePreview: InvoiceExportRow | undefined
  let taxesTotal = 0
  let folioSubtotal = 0

  try {
    const issued = await createOrRefreshStayInvoice(admin, {
      reservation,
      paymentMethod: input.paymentMethod,
      markAsPaid: paidNow,
      includeTax: input.includeTax,
      effectiveCheckOut,
      guestPhone,
      roomNumber,
      billToSameAsGuest: input.billToSameAsGuest,
      billToName: input.billToName,
    })
    invoiceId = issued.invoiceId
    invoicePreview = issued.invoicePreview
    taxesTotal = issued.taxes.total
    folioSubtotal = issued.folioSubtotal

    // Walkout may leave balance due; normal checkout must settle remaining.
    if (!isWalkout) {
      const balanceCheck = validateCheckoutBalance({
        invoiceTotal: taxesTotal,
        priorDeposit: paidNow ? taxesTotal : issued.amountPaid,
        markAsPaid: paidNow,
      })
      if (!balanceCheck.ok) {
        return { success: false, error: balanceCheck.error }
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not create or refresh invoice.',
    }
  }

  await admin
    .from('reservations')
    .update({
      check_out: effectiveCheckOut,
      total_amount: taxesTotal,
    })
    .eq('id', reservation.id)

  const departed = await transitionReservation({
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    toStatus: input.departureStatus,
    actorId: userId,
    actorRole,
    payload: {
      paymentMethod: input.paymentMethod,
      folioSubtotal,
      walkout: isWalkout,
    },
  })
  if (!departed.success) {
    return {
      success: false,
      error: departed.error ?? `Could not complete ${isWalkout ? 'walkout' : 'checkout'}.`,
    }
  }

  await transitionReservation({
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    toStatus: 'post_stay',
    actorId: userId,
    actorRole: 'system',
    bypassRoleCheck: true,
  })

  if (reservation.guest_id) {
    await admin
      .from('guests')
      .update({
        check_out: effectiveCheckOut,
        room_id: null,
        token: null,
        token_expires_at: new Date().toISOString(),
      })
      .eq('id', reservation.guest_id)

    void revokeGuestAccess({
      hotelId: reservation.hotel_id,
      guestId: reservation.guest_id,
      reservationId: reservation.id,
    })
  }

  if (reservation.room_id) {
    const { data: roomBeforeCheckout } = await admin
      .from('rooms')
      .select('number, status')
      .eq('id', reservation.room_id)
      .maybeSingle()

    if (roomBeforeCheckout && roomBeforeCheckout.status !== 'cleaning') {
      void logRoomStatusChange({
        hotelId: profile.hotel_id,
        actorId: userId,
        actorName: profile.name,
        roomId: reservation.room_id,
        roomNumber: roomBeforeCheckout.number,
        from: roomBeforeCheckout.status ?? 'available',
        to: 'cleaning',
        reason: isWalkout ? 'walkout' : 'check-out',
      })
    }

    await createPostCheckoutCleanTask(admin, {
      hotelId: reservation.hotel_id,
      roomId: reservation.room_id,
      guestName: reservation.guest_name,
      createdBy: userId,
    })
  }

  if (guestPhone && !isWalkout) {
    void import('@/lib/notifications/stays').then(({ notifyGuestCheckedOut }) =>
      runNotifyTask(
        notifyGuestCheckedOut({
        hotelId: reservation.hotel_id,
        phone: guestPhone,
        guestName: reservation.guest_name,
        totalGhs: taxesTotal,
        paid: paidNow,
      }),
        {
          templateKey: 'guest_checked_out',
          hotelId: reservation.hotel_id,
          channel: 'sms',
        },
      )
    )
  }

  revalidateStayViews()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: isWalkout ? 'walkout' : 'checked_out',
    summary: isWalkout
      ? `${reservation.guest_name} walkout — ₵${taxesTotal.toLocaleString()} balance due`
      : `${reservation.guest_name} checked out — ₵${taxesTotal.toLocaleString()} (${input.paymentMethod.replace(/_/g, ' ')}, ${paidNow ? 'paid' : 'pending'})${folioSubtotal > 0 ? ` incl. ₵${folioSubtotal} folio` : ''}`,
  })

  return { success: true, data: { invoiceId, invoicePreview } }
}

export async function beginCheckoutStay(reservationId: string): Promise<StayActionResult> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, status, guest_name')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  const canBegin =
    canCheckOut(reservation.status) || reservation.status === 'dispute_hold'
  if (!canBegin) {
    return { success: false, error: 'Only in-house stays can begin checkout.' }
  }

  const result = await transitionReservation({
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    toStatus: 'checkout_in_progress',
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
  })

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not begin checkout.' }
  }

  revalidateStayViews()
  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'checkout_initiated',
    summary: `${reservation.guest_name}: checkout started (folio locked)`,
  })

  return { success: true }
}

export async function completeCheckoutStay(input: {
  reservationId: string
  paymentMethod: PaymentMethod
  earlyCheckout?: boolean
  markAsPaid?: boolean
  includeTax?: boolean
  billToSameAsGuest?: boolean
  billToName?: string | null
}): Promise<StayActionResult<{ invoiceId: string | null; invoicePreview?: InvoiceExportRow }>> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }
  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' }
  }

  const admin = createAdminClient()
  const includeTax = input.includeTax === true
  const { data: reservation } = await admin
    .from('reservations')
    .select('*')
    .eq('id', input.reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'checkout_in_progress') {
    return {
      success: false,
      error: 'Begin checkout first, then complete payment and check-out.',
    }
  }

  return executeStayCheckout(admin, {
    reservation,
    profile: { ...profile, hotel_id: profile.hotel_id },
    userId,
    paymentMethod: input.paymentMethod,
    earlyCheckout: input.earlyCheckout,
    markAsPaid: input.markAsPaid,
    includeTax,
    billToSameAsGuest: input.billToSameAsGuest,
    billToName: input.billToName,
    departureStatus: 'checked_out',
  })
}

export async function checkOutStay(input: {
  reservationId?: string
  guestId?: string
  paymentMethod: PaymentMethod
  earlyCheckout?: boolean
  markAsPaid?: boolean
  includeTax?: boolean
  billToSameAsGuest?: boolean
  billToName?: string | null
}): Promise<StayActionResult<{ invoiceId: string | null; invoicePreview?: InvoiceExportRow }>> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }
  if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' }
  }
  if (!input.reservationId && !input.guestId) {
    return { success: false, error: 'Specify a reservation or guest to check out.' }
  }

  const admin = createAdminClient()
  const includeTax = input.includeTax === true
  let reservation: {
    id: string
    hotel_id: string
    room_id: string | null
    guest_id: string | null
    guest_name: string
    nightly_rate: number | null
    weekly_rate: number | null
    monthly_rate: number | null
    rate_type: string | null
    total_amount: number | null
    amount_paid: number | null
    check_in: string
    check_out: string
    status: string | null
  } | null = null

  if (input.reservationId) {
    const { data } = await admin
      .from('reservations')
      .select('*')
      .eq('id', input.reservationId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()
    reservation = data
  } else if (input.guestId) {
    const { data } = await admin
      .from('reservations')
      .select('*')
      .eq('guest_id', input.guestId)
      .eq('hotel_id', profile.hotel_id)
      .in('status', [...OCCUPYING_STATUSES])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    reservation = data
  }

  const today = todayISO()

  // Legacy guest without reservation — create checkout record on the fly
  if (!reservation && input.guestId) {
    const { data: guest } = await admin
      .from('guests')
      .select('*')
      .eq('id', input.guestId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()

    if (!guest?.room_id || !guest.check_in || !guest.check_out) {
      return { success: false, error: 'No active stay found for this guest.' }
    }
    if (guest.check_out < today && !input.earlyCheckout) {
      return { success: false, error: 'This stay has already ended.' }
    }

    const effectiveCheckOut = input.earlyCheckout ? today : guest.check_out
    if (effectiveCheckOut <= guest.check_in) {
      return { success: false, error: 'Check-out must be after check-in.' }
    }

    const nightlyRate = await getRoomNightlyRate(admin, guest.room_id)
    const { data: roomMeta } = await admin
      .from('rooms')
      .select('room_categories(name)')
      .eq('id', guest.room_id)
      .maybeSingle()
    const roomCat = roomMeta?.room_categories as { name?: string } | null
    const roomCategoryName = roomCat?.name?.trim() || null
    const billTo = resolveBillToName({
      guestName: guest.name,
      billToSameAsGuest: input.billToSameAsGuest,
      billToName: input.billToName,
    })
    if (!billTo.ok) {
      return { success: false, error: billTo.error }
    }
    const { taxes: roomTaxes, rates } = await computeCheckoutTaxes(
      admin,
      profile.hotel_id,
      guest.check_in,
      effectiveCheckOut,
      guest.room_id,
      'nightly',
      nightlyRate,
      null,
      null,
      guest.check_out,
      includeTax,
    )
    const { taxes, folioCharges, folioSubtotal } = await prepareCheckoutTaxesWithFolio(
      admin,
      profile.hotel_id,
      guest.id,
      null,
      roomTaxes,
      includeTax,
      rates,
    )
    const now = new Date().toISOString()
    const paidNow = input.markAsPaid !== false
    const dueAt = paidNow
      ? now
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const checkoutPayment = buildCheckoutInvoicePaymentState({
      invoiceTotal: taxes.total,
      priorDeposit: 0,
      paidNow,
    })

    const { data: newRes } = await admin
      .from('reservations')
      .insert({
        hotel_id: profile.hotel_id,
        room_id: guest.room_id,
        guest_id: guest.id,
        guest_name: guest.name,
        check_in: guest.check_in,
        check_out: effectiveCheckOut,
        status: 'checked_out',
        channel: 'walk_in',
        nightly_rate: nightlyRate,
        total_amount: taxes.total,
        amount_paid: checkoutPayment.amountPaid,
        payment_status: checkoutPayment.paymentStatus,
        payment_method: input.paymentMethod,
        created_by: userId,
      })
      .select('id')
      .single()

    const invoiceNumber = await allocateInvoiceNumber(profile.hotel_id)
    const { data: invoiceRow } = await admin
      .from('invoices')
      .insert({
        hotel_id: profile.hotel_id,
        reservation_id: newRes?.id ?? null,
        guest_id: guest.id,
        guest_name: guest.name,
        bill_to_name: billTo.value,
        room_category_name: roomCategoryName,
        invoice_number: invoiceNumber,
        subtotal: taxes.subtotal,
        nhil_amount: taxes.nhil,
        getfund_amount: taxes.getfund,
        covid_levy_amount: taxes.covid,
        vat_amount: taxes.vat,
        elevy_amount: taxes.elevy,
        tourism_levy_amount: taxes.tourism,
        tax_snapshot: taxSnapshotFromRates(rates),
        guest_tax_id: resolveInvoiceTaxId(input.includeTax === true),
        total_amount: taxes.total,
        payment_method: input.paymentMethod,
        payment_status: checkoutPayment.paymentStatus,
        amount_paid: checkoutPayment.amountPaid,
        issued_at: now,
        due_at: dueAt,
        paid_at: checkoutPayment.paymentStatus === 'paid' ? now : null,
      })
      .select('id')
      .single()

    if (invoiceRow?.id && folioCharges.length) {
      await linkFolioChargesToInvoice(
        admin,
        folioCharges.map((c) => c.id),
        invoiceRow.id,
      )
    }

    if (invoiceRow?.id && newRes?.id) {
      await finalizeReservationCheckoutPayment(admin, {
        reservationId: newRes.id,
        invoiceId: invoiceRow.id,
        hotelId: profile.hotel_id,
        guestId: guest.id,
        invoiceTotal: taxes.total,
        priorDeposit: 0,
        paidNow,
        paymentMethod: input.paymentMethod,
        now,
      })
    }

    await admin
      .from('guests')
      .update({
        check_out: effectiveCheckOut,
        room_id: null,
        token: null,
        token_expires_at: new Date().toISOString(),
      })
      .eq('id', guest.id)

    if (guest.room_id) {
      const { data: roomBeforeCheckout } = await admin
        .from('rooms')
        .select('number, status')
        .eq('id', guest.room_id)
        .maybeSingle()

      await admin
        .from('rooms')
        .update({ status: 'cleaning', updated_by: userId, updated_at: now })
        .eq('id', guest.room_id)

      if (roomBeforeCheckout && roomBeforeCheckout.status !== 'cleaning') {
        void logRoomStatusChange({
          hotelId: profile.hotel_id,
          actorId: userId,
          actorName: profile.name,
          roomId: guest.room_id,
          roomNumber: roomBeforeCheckout.number,
          from: roomBeforeCheckout.status ?? 'available',
          to: 'cleaning',
          reason: 'check-out',
        })
      }

      await createPostCheckoutCleanTask(admin, {
        hotelId: profile.hotel_id,
        roomId: guest.room_id,
        guestName: guest.name,
        createdBy: userId,
      })
    }

    revalidateStayViews()

    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: userId,
      actorName: profile.name,
      entityType: 'reservation',
      entityId: newRes?.id ?? null,
      action: 'checked_out',
      summary: `${guest.name} checked out (legacy guest record) — ${input.paymentMethod.replace(/_/g, ' ')}${folioSubtotal > 0 ? ` (+₵${folioSubtotal} folio)` : ''}`,
    })

    return { success: true, data: { invoiceId: invoiceRow?.id ?? null } }
  }

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (canCheckOut(reservation.status)) {
    const begin = await beginCheckoutStay(reservation.id)
    if (!begin.success) return begin
  } else if (reservation.status !== 'checkout_in_progress') {
    return { success: false, error: 'Only checked-in stays can be checked out.' }
  }

  return completeCheckoutStay({
    reservationId: reservation.id,
    paymentMethod: input.paymentMethod,
    earlyCheckout: input.earlyCheckout,
    markAsPaid: input.markAsPaid,
    includeTax,
    billToSameAsGuest: input.billToSameAsGuest,
    billToName: input.billToName,
  })
}

export async function recordWalkoutStay(
  reservationId: string,
  input?: {
    paymentMethod?: PaymentMethod
    earlyCheckout?: boolean
    includeTax?: boolean
    billToSameAsGuest?: boolean
    billToName?: string | null
  },
): Promise<StayActionResult<{ invoiceId: string | null }>> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const paymentMethod = input?.paymentMethod ?? 'cash'
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return { success: false, error: 'Invalid payment method.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }

  const walkoutAllowed = ['checked_in', 'overstay', 'checkout_in_progress', 'dispute_hold']
  if (!walkoutAllowed.includes(reservation.status ?? '')) {
    return { success: false, error: 'Walkout is only available for in-house stays.' }
  }

  return executeStayCheckout(admin, {
    reservation,
    profile: { ...profile, hotel_id: profile.hotel_id },
    userId,
    paymentMethod,
    earlyCheckout: input?.earlyCheckout,
    markAsPaid: false,
    includeTax: input?.includeTax === true,
    billToSameAsGuest: input?.billToSameAsGuest,
    billToName: input?.billToName,
    departureStatus: 'walkout',
  })
}

export async function approveLateCheckout(
  reservationId: string,
  input?: { approvedUntil?: string; note?: string },
): Promise<StayActionResult> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, status, guest_name, check_out')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'overstay' && reservation.status !== 'checked_in') {
    return { success: false, error: 'Late checkout approval applies to in-house stays only.' }
  }

  const result = await appendReservationEvent({
    reservationId: reservation.id,
    hotelId: reservation.hotel_id,
    eventType: 'late_checkout_approved',
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
    payload: {
      approvedUntil: input?.approvedUntil?.trim() || null,
      note: input?.note?.trim() || null,
    },
  })

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not approve late checkout.' }
  }

  revalidateStayViews()
  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'late_checkout_approved',
    summary: `${reservation.guest_name}: late checkout approved${input?.approvedUntil ? ` until ${input.approvedUntil}` : ''}`,
  })

  return { success: true }
}

export async function extendStay(
  reservationId: string,
  newCheckOut: string,
): Promise<StayActionResult> {
  const { profile } = await requireManager()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'checked_in') {
    return { success: false, error: 'Only in-house stays can be extended.' }
  }
  if (newCheckOut <= reservation.check_out) {
    return { success: false, error: 'New check-out must be after the current check-out date.' }
  }
  if (!reservation.room_id) return { success: false, error: 'No room on this stay.' }

  if (
    await roomHasClash(
      admin,
      profile.hotel_id,
      reservation.room_id,
      reservation.check_in,
      newCheckOut,
      { excludeReservationId: reservationId, excludeGuestId: reservation.guest_id ?? undefined },
    )
  ) {
    const suggestions = await findAvailableRooms(
      admin,
      profile.hotel_id,
      reservation.check_in,
      newCheckOut,
      { excludeReservationId: reservationId },
    )
    return {
      success: false,
      error: 'Room is booked for the extended dates.',
      suggestions,
    }
  }

  const rateType = (reservation.rate_type ?? 'nightly') as RateType
  const roomRates = await getRoomRates(admin, reservation.room_id)
  const nightlyRate =
    reservation.nightly_rate != null ? Number(reservation.nightly_rate) : roomRates.nightlyRate
  const weeklyRate =
    reservation.weekly_rate != null ? Number(reservation.weekly_rate) : roomRates.weeklyRate
  const monthlyRate =
    reservation.monthly_rate != null ? Number(reservation.monthly_rate) : roomRates.monthlyRate
  const total = calculateStayTotal(
    rateType,
    reservation.check_in,
    newCheckOut,
    nightlyRate,
    monthlyRate,
    weeklyRate,
  )
  const tokenExpiresAt = tokenExpiryISO(newCheckOut)

  await admin
    .from('reservations')
    .update({ check_out: newCheckOut, total_amount: total })
    .eq('id', reservationId)

  await refreshPreCheckoutPaymentStatus(admin, reservationId)

  if (reservation.guest_id) {
    await admin
      .from('guests')
      .update({ check_out: newCheckOut, token_expires_at: tokenExpiresAt })
      .eq('id', reservation.guest_id)

    void updateGuestAccessValidity({
      hotelId: profile.hotel_id,
      guestId: reservation.guest_id,
      reservationId,
      checkIn: reservation.check_in,
      checkOut: newCheckOut,
    })
  }

  await appendReservationEvent({
    reservationId,
    hotelId: profile.hotel_id,
    eventType: 'stay_extended',
    actorId: profile.id,
    actorRole: normalizeActorRole(profile.role),
    payload: {
      old_check_out: reservation.check_out,
      new_check_out: newCheckOut,
    },
  })

  revalidateStayViews()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'extended',
    summary: `${reservation.guest_name}: stay extended ${reservation.check_out} → ${newCheckOut}`,
  })

  return { success: true }
}

export async function moveStayRoom(
  reservationId: string,
  newRoomId: string,
): Promise<StayActionResult> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('*')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'checked_in') {
    return { success: false, error: 'Only in-house stays can be moved.' }
  }
  if (reservation.room_id === newRoomId) {
    return { success: false, error: 'Guest is already in that room.' }
  }

  if (
    await roomHasClash(
      admin,
      profile.hotel_id,
      newRoomId,
      reservation.check_in,
      reservation.check_out,
      { excludeReservationId: reservationId, excludeGuestId: reservation.guest_id ?? undefined },
    )
  ) {
    const suggestions = await findAvailableRooms(
      admin,
      profile.hotel_id,
      reservation.check_in,
      reservation.check_out,
      { excludeReservationId: reservationId },
    )
    return {
      success: false,
      error: 'That room is not available for these dates.',
      suggestions,
    }
  }

  const oldRoomId = reservation.room_id
  const now = new Date().toISOString()

  const [{ data: oldRoom }, { data: newRoom }] = await Promise.all([
    oldRoomId
      ? admin.from('rooms').select('number, status').eq('id', oldRoomId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('rooms').select('number, status').eq('id', newRoomId).maybeSingle(),
  ])

  await admin.from('reservations').update({ room_id: newRoomId }).eq('id', reservationId)

  if (reservation.guest_id) {
    await admin.from('guests').update({ room_id: newRoomId }).eq('id', reservation.guest_id)

    void rematerializeGuestAccessForRoomMove({
      hotelId: profile.hotel_id,
      guestId: reservation.guest_id,
      reservationId,
      guestName: reservation.guest_name,
      newRoomId,
      checkIn: reservation.check_in,
      checkOut: reservation.check_out,
    })
  }

  if (oldRoomId) {
    await admin
      .from('rooms')
      .update({ status: 'cleaning', updated_by: userId, updated_at: now })
      .eq('id', oldRoomId)

    if (oldRoom && oldRoom.status !== 'cleaning') {
      void logRoomStatusChange({
        hotelId: profile.hotel_id,
        actorId: userId,
        actorName: profile.name,
        roomId: oldRoomId,
        roomNumber: oldRoom.number,
        from: oldRoom.status ?? 'available',
        to: 'cleaning',
        reason: 'guest moved',
      })
    }
  }

  await admin
    .from('rooms')
    .update({ status: 'occupied', updated_by: userId, updated_at: now })
    .eq('id', newRoomId)

  if (newRoom && newRoom.status !== 'occupied') {
    void logRoomStatusChange({
      hotelId: profile.hotel_id,
      actorId: userId,
      actorName: profile.name,
      roomId: newRoomId,
      roomNumber: newRoom.number,
      from: newRoom.status ?? 'available',
      to: 'occupied',
      reason: 'guest moved in',
    })
  }

  revalidateStayViews()

  await appendReservationEvent({
    reservationId,
    hotelId: profile.hotel_id,
    eventType: 'room_moved',
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
    payload: {
      old_room_id: oldRoomId,
      new_room_id: newRoomId,
      moved_at: now,
    },
  })

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'room_moved',
    summary: `${reservation.guest_name}: Room ${oldRoom?.number ?? '?'} → ${newRoom?.number ?? '?'}`,
  })

  return { success: true }
}

export async function markNoShow(
  reservationId: string,
  options?: { depositDisposition?: import('@/lib/billing/deposit-disposition').DepositDisposition },
): Promise<StayActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, status, check_in, guest_name, guest_id, hotel_id, amount_paid')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'confirmed' && reservation.status !== 'pre_arrival') {
    return { success: false, error: 'Only confirmed or pre-arrival reservations can be marked as no-show.' }
  }

  const admin = createAdminClient()
  const { validateReservationCancellation } = await import('@/lib/reservations/cancel-eligibility')
  const eligibility = await validateReservationCancellation(admin, {
    id: reservationId,
    status: reservation.status,
    guest_id: reservation.guest_id,
    hotel_id: reservation.hotel_id,
  })
  if (!eligibility.ok) return { success: false, error: eligibility.error }

  const {
    applyDepositDisposition,
    requiresDepositDisposition,
    validateDepositDispositionInput,
  } = await import('@/lib/billing/deposit-disposition')

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
      reservationId,
      guestId: reservation.guest_id,
      guestName: reservation.guest_name,
      amountPaid,
      disposition: options.depositDisposition,
      reason: 'no_show',
      actorId: profile.id,
      actorName: profile.name ?? 'Staff',
    })
    if (!applied.ok) return { success: false, error: applied.error }
  }

  const { data: hotelPolicy } = await admin
    .from('hotels')
    .select('no_show_charge_policy, no_show_hold_room')
    .eq('id', reservation.hotel_id)
    .maybeSingle()

  const noShow = await transitionReservation({
    reservationId,
    hotelId: reservation.hotel_id,
    toStatus: 'no_show',
    actorId: profile.id,
    actorRole: normalizeActorRole(profile.role),
    payload: {
      amountPaid,
      policy: hotelPolicy?.no_show_charge_policy ?? 'one_night',
      holdRoom: hotelPolicy?.no_show_hold_room ?? false,
    },
  })
  if (!noShow.success) {
    return { success: false, error: noShow.error ?? 'Could not mark no-show.' }
  }

  if (reservation.guest_id) {
    await admin
      .from('guests')
      .update({
        token: null,
        token_expires_at: new Date().toISOString(),
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
    entityId: reservationId,
    action: 'no_show',
    summary: `${reservation.guest_name}: marked no-show (arrival ${reservation.check_in})`,
  })

  return { success: true }
}

export async function beginDisputeHold(
  reservationId: string,
  note: string,
): Promise<StayActionResult> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const parsedNote = parseRequiredStayNote(note, 'Add a short reason for the hold.')
  if (!parsedNote.ok) return { success: false, error: parsedNote.error }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, status, guest_name')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (!canStartDisputeHold(reservation.status)) {
    return { success: false, error: 'Dispute hold applies only to in-house stays or checkout in progress.' }
  }

  const result = await transitionReservation({
    reservationId,
    hotelId: profile.hotel_id,
    toStatus: 'dispute_hold',
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
    payload: { reason: parsedNote.note },
  })

  if (!result.success) return { success: false, error: result.error ?? 'Could not start dispute hold.' }

  revalidateStayViews()
  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'dispute_hold_started',
    summary: `${reservation.guest_name}: billing dispute hold`,
    details: { reason: parsedNote.note, fromStatus: reservation.status },
  })

  return { success: true }
}

export async function releaseDisputeHold(
  reservationId: string,
  note: string,
): Promise<StayActionResult> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const parsedNote = parseRequiredStayNote(note, 'Add a short note explaining the resolution.')
  if (!parsedNote.ok) return { success: false, error: parsedNote.error }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, status, guest_name, check_out')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'dispute_hold') {
    return { success: false, error: 'This stay is not on dispute hold.' }
  }

  const { data: hotel } = await admin
    .from('hotels')
    .select('timezone')
    .eq('id', profile.hotel_id)
    .maybeSingle()
  const today = hotelTodayISO(normalizeHotelTimezone(hotel?.timezone))
  const toStatus = statusAfterDisputeHoldRelease(reservation.check_out, today)

  const result = await transitionReservation({
    reservationId,
    hotelId: profile.hotel_id,
    toStatus,
    actorId: userId,
    actorRole: normalizeActorRole(profile.role),
    payload: { note: parsedNote.note },
  })

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not release dispute hold.' }
  }

  revalidateStayViews()
  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'dispute_hold_released',
    summary: `${reservation.guest_name}: dispute hold released (${toStatus.replace(/_/g, ' ')})`,
    details: { note: parsedNote.note, toStatus },
  })

  return { success: true }
}

export async function releaseNoShowRoomHold(reservationId: string): Promise<StayActionResult> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id, hotel_id, status, room_id, guest_name, room_held_until')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'no_show' || !reservation.room_held_until) {
    return { success: false, error: 'This reservation is not holding a room after no-show.' }
  }

  await admin
    .from('reservations')
    .update({ room_held_until: null })
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)

  if (reservation.room_id) {
    const { data: hotelRow } = await admin
      .from('hotels')
      .select('timezone')
      .eq('id', profile.hotel_id)
      .maybeSingle()
    const tz = normalizeHotelTimezone(hotelRow?.timezone)
    const today = hotelTodayISO(tz)
    const { roomHasClash } = await import('@/lib/data/occupancy')
    const stillBlocked = await roomHasClash(
      admin,
      profile.hotel_id,
      reservation.room_id,
      today,
      addDaysISO(today, 1),
      { excludeReservationId: reservationId },
    )
    if (!stillBlocked) {
      await admin
        .from('rooms')
        .update({ status: 'available', updated_by: userId })
        .eq('id', reservation.room_id)
        .eq('hotel_id', profile.hotel_id)
    }
  }

  revalidateStayViews()
  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'no_show_room_released',
    summary: `${reservation.guest_name}: no-show room hold released`,
  })

  return { success: true }
}

export async function getRoomsWithRates(): Promise<
  StayActionResult<
    { id: string; number: string; nightlyRate: number; weeklyRate: number; monthlyRate: number }[]
  >
> {
  const { profile } = await requireManager()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rooms')
    .select(
      'id, number, nightly_rate, weekly_rate, monthly_rate, room_categories(default_nightly_rate, default_weekly_rate, default_monthly_rate)',
    )
    .eq('hotel_id', profile.hotel_id)
    .order('number')

  if (error) return { success: false, error: error.message }

  const rooms = (data ?? []).map((r) => {
    const cat = r.room_categories as {
      default_nightly_rate?: number
      default_weekly_rate?: number | null
      default_monthly_rate?: number | null
    } | null
    const nightlyRate =
      r.nightly_rate != null ? Number(r.nightly_rate) : Number(cat?.default_nightly_rate ?? 0)
    const weeklyRate =
      r.weekly_rate != null ? Number(r.weekly_rate) : Number(cat?.default_weekly_rate ?? 0)
    const monthlyRate =
      r.monthly_rate != null
        ? Number(r.monthly_rate)
        : Number(cat?.default_monthly_rate ?? 0)
    return { id: r.id, number: r.number, nightlyRate, weeklyRate, monthlyRate }
  })

  return { success: true, data: rooms }
}

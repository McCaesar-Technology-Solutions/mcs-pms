'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeInvoiceTaxes, noTaxInvoice } from '@/lib/tax'
import { getHotelVatMode } from '@/lib/data/settings'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import { createPostCheckoutCleanTask } from '@/lib/housekeeping/checkout-task'
import { phoneSchema } from '@/lib/phone'
import { findAvailableRooms, roomHasClash } from '@/lib/data/occupancy'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
import { getRoomRates } from '@/lib/pricing/room-rates'
import {
  buildGuestLoginUrl,
  stayNights,
  todayISO,
  tokenExpiryISO,
} from '@/lib/stays/helpers'
import { revalidateStayViews } from '@/lib/stays/revalidate'
import {
  linkFolioChargesToInvoice,
  prepareCheckoutTaxesWithFolio,
} from '@/lib/folio/rollup'
import { writeAuditLog, logRoomStatusChange } from '@/lib/audit/log'
import {
  buildCheckoutInvoicePaymentState,
  finalizeReservationCheckoutPayment,
  refreshPreCheckoutPaymentStatus,
} from '@/lib/billing/reservation-payment'
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
})

async function requireManager() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, name')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, profile, userId: user.id }
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
  includeTax = true,
) {
  const vatMode = await getHotelVatMode(hotelId)

  let chargeAmount = 0
  if (
    totalAmountInput != null &&
    plannedCheckOut &&
    effectiveCheckOut === plannedCheckOut
  ) {
    chargeAmount = Number(totalAmountInput)
  } else if (roomId) {
    const rateType = (rateTypeInput ?? 'nightly') as RateType
    const nightlyRate =
      nightlyRateInput != null ? Number(nightlyRateInput) : await getRoomNightlyRate(admin, roomId)
    const monthlyRate =
      monthlyRateInput != null
        ? Number(monthlyRateInput)
        : (await getRoomRates(admin, roomId)).monthlyRate
    chargeAmount = calculateStayTotal(rateType, checkIn, effectiveCheckOut, nightlyRate, monthlyRate)
  }

  const taxes = includeTax
    ? computeInvoiceTaxes(chargeAmount, vatMode)
    : noTaxInvoice(chargeAmount)
  return { chargeAmount, taxes, vatMode }
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
        .eq('status', 'checked_in')
        .maybeSingle()
      if (activeRes) return g.id
    }
  }
  return null
}

export async function searchGuests(query: string): Promise<
  StayActionResult<{ id: string; name: string; phone: string | null; email: string | null }[]>
> {
  const { profile } = await requireManager()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const q = query.trim().replace(/[,()]/g, ' ').trim()
  if (q.length < 2) return { success: true, data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('guests')
    .select('id, name, phone, email')
    .eq('hotel_id', profile.hotel_id)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .order('name')
    .limit(8)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

export async function checkInStay(
  reservationId: string,
  input: { phone: string; email?: string; guestId?: string; guestName?: string },
): Promise<StayActionResult<{ loginUrl: string; token: string; guestId: string }>> {
  const parsed = checkInStaySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

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
  if (reservation.status !== 'confirmed') {
    return { success: false, error: 'Only confirmed reservations can be checked in.' }
  }
  if (!reservation.room_id) return { success: false, error: 'Reservation has no room assigned.' }

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

  let guestId = parsed.data.guestId ?? reservation.guest_id ?? null

  if (guestId) {
    const { data: existing } = await admin
      .from('guests')
      .select('id')
      .eq('id', guestId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()
    if (!existing) return { success: false, error: 'Guest not found.' }

    const { error: guestError } = await admin
      .from('guests')
      .update({
        name: guestName,
        phone: parsed.data.phone.trim(),
        email: parsed.data.email || null,
        room_id: reservation.room_id,
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        token,
        token_expires_at: tokenExpiresAt,
      })
      .eq('id', guestId)

    if (guestError) return { success: false, error: guestError.message }
  } else {
    const { data: newGuest, error: guestError } = await admin
      .from('guests')
      .insert({
        hotel_id: profile.hotel_id,
        room_id: reservation.room_id,
        name: guestName,
        phone: parsed.data.phone.trim(),
        email: parsed.data.email || null,
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
  }

  const { error: resError } = await admin
    .from('reservations')
    .update({
      guest_id: guestId,
      guest_name: guestName,
      status: 'checked_in',
    })
    .eq('id', reservationId)

  if (resError) return { success: false, error: resError.message }

  const { data: roomBeforeCheckIn } = await admin
    .from('rooms')
    .select('number, status')
    .eq('id', reservation.room_id)
    .maybeSingle()

  await admin
    .from('rooms')
    .update({
      status: 'occupied',
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservation.room_id)

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

  void import('@/lib/notifications/stays').then(({ notifyGuestCheckedIn }) =>
    notifyGuestCheckedIn({
      hotelId: profile.hotel_id!,
      phone: parsed.data.phone.trim(),
      guestName,
      roomNumber: roomRow?.number ?? null,
      checkOut: reservation.check_out,
      portalToken: token,
    }).catch(() => undefined),
  )

  revalidateStayViews()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservationId,
    action: 'checked_in',
    summary: `${guestName} checked in${roomRow?.number ? ` — Room ${roomRow.number}` : ''} (${reservation.check_in} → ${reservation.check_out})`,
  })

  return { success: true, data: { loginUrl, token, guestId } }
}

export async function walkInCheckIn(input: {
  name: string
  phone: string
  email?: string
  roomId: string
  checkOut: string
  rateType?: RateType
  nightlyRate?: number
  monthlyRate?: number
}): Promise<
  StayActionResult<{ loginUrl: string; token: string; reservationId: string; guestId: string }>
> {
  const { profile, userId } = await requireManager()
  if (!profile?.hotel_id || !userId || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const checkIn = todayISO()
  if (input.checkOut <= checkIn) {
    return { success: false, error: 'Check-out must be a future date.' }
  }

  const admin = createAdminClient()

  if (await roomHasClash(admin, profile.hotel_id, input.roomId, checkIn, input.checkOut)) {
    const suggestions = await findAvailableRooms(admin, profile.hotel_id, checkIn, input.checkOut)
    return {
      success: false,
      error: 'That room is already occupied for these dates.',
      suggestions,
    }
  }

  const rateType = input.rateType ?? 'nightly'
  const roomRates = await getRoomRates(admin, input.roomId)
  const nightlyRate =
    rateType === 'nightly' ? (input.nightlyRate ?? roomRates.nightlyRate) : roomRates.nightlyRate
  const monthlyRate =
    rateType === 'monthly' ? (input.monthlyRate ?? roomRates.monthlyRate) : roomRates.monthlyRate
  const total = calculateStayTotal(rateType, checkIn, input.checkOut, nightlyRate, monthlyRate)

  const { data: reservation, error: resError } = await admin
    .from('reservations')
    .insert({
      hotel_id: profile.hotel_id,
      room_id: input.roomId,
      guest_name: input.name.trim(),
      check_in: checkIn,
      check_out: input.checkOut,
      status: 'confirmed',
      channel: 'walk_in' as ReservationChannel,
      rate_type: rateType,
      nightly_rate: nightlyRate,
      monthly_rate: monthlyRate,
      total_amount: total,
      created_by: userId,
    })
    .select('id')
    .single()

  if (resError || !reservation) {
    return { success: false, error: resError?.message ?? 'Could not create stay.' }
  }

  const { data: walkInRoom } = await admin
    .from('rooms')
    .select('number')
    .eq('id', input.roomId)
    .maybeSingle()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'created',
    summary: `Walk-in booking for ${input.name.trim()}${walkInRoom?.number ? ` — Room ${walkInRoom.number}` : ''} (${checkIn} → ${input.checkOut})`,
  })

  const checkInResult = await checkInStay(reservation.id, {
    phone: input.phone,
    email: input.email,
    guestName: input.name.trim(),
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

export async function checkOutStay(input: {
  reservationId?: string
  guestId?: string
  paymentMethod: PaymentMethod
  earlyCheckout?: boolean
  markAsPaid?: boolean
  includeTax?: boolean
}): Promise<StayActionResult> {
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
  const includeTax = input.includeTax !== false
  let reservation: {
    id: string
    hotel_id: string
    room_id: string | null
    guest_id: string | null
    guest_name: string
    nightly_rate: number | null
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
      .eq('status', 'checked_in')
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
    const { taxes: roomTaxes } = await computeCheckoutTaxes(
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
        invoice_number: invoiceNumber,
        subtotal: taxes.subtotal,
        nhil_amount: taxes.nhil,
        getfund_amount: taxes.getfund,
        covid_levy_amount: taxes.covid,
        vat_amount: taxes.vat,
        elevy_amount: taxes.elevy,
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

    return { success: true }
  }

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'checked_in') {
    return { success: false, error: 'Only checked-in stays can be checked out.' }
  }

  let guestPhone: string | null = null
  if (reservation.guest_id) {
    const { data: guestRow } = await admin
      .from('guests')
      .select('phone')
      .eq('id', reservation.guest_id)
      .maybeSingle()
    guestPhone = guestRow?.phone?.trim() ?? null
  }

  const effectiveCheckOut = input.earlyCheckout ? today : reservation.check_out
  if (effectiveCheckOut <= reservation.check_in) {
    return { success: false, error: 'Check-out must be after check-in.' }
  }

  const { taxes: roomTaxes } = await computeCheckoutTaxes(
    admin,
    reservation.hotel_id,
    reservation.check_in,
    effectiveCheckOut,
    reservation.room_id,
    reservation.rate_type,
    reservation.nightly_rate,
    reservation.monthly_rate,
    reservation.total_amount,
    reservation.check_out,
    includeTax,
  )

  const guestIdForFolio = reservation.guest_id
  const { taxes, folioCharges, folioSubtotal } = guestIdForFolio
    ? await prepareCheckoutTaxesWithFolio(
        admin,
        reservation.hotel_id,
        guestIdForFolio,
        reservation.id,
        roomTaxes,
        includeTax,
      )
    : { taxes: roomTaxes, folioCharges: [], folioSubtotal: 0 }
  const now = new Date().toISOString()
  const paidNow = input.markAsPaid !== false
  const dueAt = paidNow
    ? now
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const priorDeposit = Number(reservation.amount_paid ?? 0)
  const checkoutPayment = buildCheckoutInvoicePaymentState({
    invoiceTotal: taxes.total,
    priorDeposit,
    paidNow,
  })

  const { data: existingInvoice } = await admin
    .from('invoices')
    .select('id')
    .eq('reservation_id', reservation.id)
    .maybeSingle()

  if (!existingInvoice) {
    const invoiceNumber = await allocateInvoiceNumber(reservation.hotel_id)
    const { data: invoiceRow } = await admin
      .from('invoices')
      .insert({
        hotel_id: reservation.hotel_id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        guest_name: reservation.guest_name,
        invoice_number: invoiceNumber,
        subtotal: taxes.subtotal,
        nhil_amount: taxes.nhil,
        getfund_amount: taxes.getfund,
        covid_levy_amount: taxes.covid,
        vat_amount: taxes.vat,
        elevy_amount: taxes.elevy,
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

    if (invoiceRow?.id) {
      await finalizeReservationCheckoutPayment(admin, {
        reservationId: reservation.id,
        invoiceId: invoiceRow.id,
        hotelId: reservation.hotel_id,
        guestId: reservation.guest_id,
        invoiceTotal: taxes.total,
        priorDeposit,
        paidNow,
        paymentMethod: input.paymentMethod,
        now,
      })
    }
  }

  await admin
    .from('reservations')
    .update({
      status: 'checked_out',
      check_out: effectiveCheckOut,
      total_amount: taxes.total,
      ...(existingInvoice
        ? {}
        : {
            amount_paid: checkoutPayment.amountPaid,
            payment_status: checkoutPayment.paymentStatus,
            payment_method: input.paymentMethod,
          }),
    })
    .eq('id', reservation.id)

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
  }

  if (reservation.room_id) {
    const { data: roomBeforeCheckout } = await admin
      .from('rooms')
      .select('number, status')
      .eq('id', reservation.room_id)
      .maybeSingle()

    await admin
      .from('rooms')
      .update({ status: 'cleaning', updated_by: userId, updated_at: now })
      .eq('id', reservation.room_id)

    if (roomBeforeCheckout && roomBeforeCheckout.status !== 'cleaning') {
      void logRoomStatusChange({
        hotelId: profile.hotel_id,
        actorId: userId,
        actorName: profile.name,
        roomId: reservation.room_id,
        roomNumber: roomBeforeCheckout.number,
        from: roomBeforeCheckout.status ?? 'available',
        to: 'cleaning',
        reason: 'check-out',
      })
    }

    await createPostCheckoutCleanTask(admin, {
      hotelId: reservation.hotel_id,
      roomId: reservation.room_id,
      guestName: reservation.guest_name,
      createdBy: userId,
    })
  }

  if (guestPhone) {
    void import('@/lib/notifications/stays').then(({ notifyGuestCheckedOut }) =>
      notifyGuestCheckedOut({
        hotelId: reservation.hotel_id,
        phone: guestPhone,
        guestName: reservation.guest_name,
        totalGhs: taxes.total,
        paid: paidNow,
      }).catch(() => undefined),
    )
  }

  revalidateStayViews()

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: userId,
    actorName: profile.name,
    entityType: 'reservation',
    entityId: reservation.id,
    action: 'checked_out',
    summary: `${reservation.guest_name} checked out — ₵${taxes.total.toLocaleString()} (${input.paymentMethod.replace(/_/g, ' ')}, ${paidNow ? 'paid' : 'pending'})${folioSubtotal > 0 ? ` incl. ₵${folioSubtotal} folio` : ''}`,
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
  const nightlyRate =
    reservation.nightly_rate != null
      ? Number(reservation.nightly_rate)
      : await getRoomNightlyRate(admin, reservation.room_id)
  const monthlyRate =
    reservation.monthly_rate != null
      ? Number(reservation.monthly_rate)
      : (await getRoomRates(admin, reservation.room_id)).monthlyRate
  const total = calculateStayTotal(
    rateType,
    reservation.check_in,
    newCheckOut,
    nightlyRate,
    monthlyRate,
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
  }

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
  if (!profile || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, status, check_in, guest_name, guest_id, hotel_id, amount_paid')
    .eq('id', reservationId)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }
  if (reservation.status !== 'confirmed') {
    return { success: false, error: 'Only confirmed reservations can be marked as no-show.' }
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

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'no_show' })
    .eq('id', reservationId)

  if (error) return { success: false, error: error.message }

  if (reservation.guest_id) {
    const admin = createAdminClient()
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

export async function getRoomsWithRates(): Promise<
  StayActionResult<{ id: string; number: string; nightlyRate: number; monthlyRate: number }[]>
> {
  const { profile } = await requireManager()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('rooms')
    .select('id, number, nightly_rate, monthly_rate, room_categories(default_nightly_rate, default_monthly_rate)')
    .eq('hotel_id', profile.hotel_id)
    .order('number')

  if (error) return { success: false, error: error.message }

  const rooms = (data ?? []).map((r) => {
    const cat = r.room_categories as {
      default_nightly_rate?: number
      default_monthly_rate?: number | null
    } | null
    const nightlyRate =
      r.nightly_rate != null ? Number(r.nightly_rate) : Number(cat?.default_nightly_rate ?? 0)
    const monthlyRate =
      r.monthly_rate != null
        ? Number(r.monthly_rate)
        : Number(cat?.default_monthly_rate ?? 0)
    return { id: r.id, number: r.number, nightlyRate, monthlyRate }
  })

  return { success: true, data: rooms }
}

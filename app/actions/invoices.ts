'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import {
  canApplyGuestDiscount,
  canCreateManualInvoice,
  canIssueStayInvoice,
  canIssueUnpaidStayInvoice,
  canRecordInvoicePayment,
  canRefundInvoice,
} from '@/lib/auth/tenant-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import {
  computeInvoiceTaxesWithOption,
  parseTaxSnapshot,
  taxSnapshotFromRates,
} from '@/lib/tax'
import { resolveInvoiceTaxId } from '@/lib/billing/ghana-card'
import { getHotelTaxConfig, getHotelCheckInPaymentPolicy } from '@/lib/data/settings'
import {
  getStayPaymentHistory,
  type StayPaymentHistoryRow,
} from '@/lib/data/stay-payment-history'
import {
  invoiceBalanceDue,
} from '@/lib/billing/invoice-payments'
import { applyInvoicePaymentRecord } from '@/lib/billing/apply-payment'
import { createOrRefreshStayInvoice } from '@/lib/billing/build-stay-invoice'
import { resolveBillToName } from '@/lib/billing/bill-to'
import { computeDiscountAmount, normalizeDiscountType } from '@/lib/billing/discount'
import { syncReservationPaymentFromInvoice } from '@/lib/billing/reservation-payment'
import { applyStayPayment } from '@/lib/billing/apply-stay-payment'
import {
  assertCheckInPaymentMet,
  formatCheckInPaymentPolicyLabel,
  isChannelPrepaidStay,
  requiredPaymentAtCheckIn,
} from '@/lib/billing/check-in-payment-policy'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
import { getRoomRates } from '@/lib/pricing/room-rates'
import { refundOnlineInvoicePayments } from '@/lib/payments/refund-online'
import { writeAuditLog } from '@/lib/audit/log'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { stayNights } from '@/lib/stays/helpers'
import { withInvoiceHotelContact } from '@/lib/export/invoice-hotel-contact'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
import type { PaymentMethod, PaymentStatus } from '@/types'

export type InvoiceActionResult = { success: true } | { success: false; error: string }

export type IssueStayInvoiceResult =
  | {
      success: true
      invoiceId: string
      invoicePreview: InvoiceExportRow
      created: boolean
      paymentStatus: PaymentStatus
    }
  | { success: false; error: string }

export type StaffInvoiceExportResult =
  | { success: true; data: { hotel: ExportHotelInfo; invoice: InvoiceExportRow } }
  | { success: false; error: string }

export type CollectStayPaymentResult =
  | (Extract<IssueStayInvoiceResult, { success: true }> & {
      amountApplied: number
      balanceDue: number
      requiredMinimum: number
    })
  | { success: false; error: string }

export type StayCollectContextResult =
  | {
      success: true
      data: {
        requiredMinimum: number
        balanceDue: number
        amountPaid: number
        invoiceTotal: number
        canWaiveMinimum: boolean
        policyLabel: string
        channelPrepaid: boolean
        minimumAlreadyMet: boolean
      }
    }
  | { success: false; error: string }

export type StayPaymentHistoryResult =
  | { success: true; data: StayPaymentHistoryRow[] }
  | { success: false; error: string }

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'mtn_momo',
  'telecel_cash',
  'airteltigo',
  'visa',
  'mastercard',
  'cash',
  'bank_transfer',
]

const createManualInvoiceSchema = z.object({
  guestName: z.string().min(2),
  guestId: z.string().uuid().optional(),
  description: z.string().max(200).optional(),
  subtotal: z.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum([
    'mtn_momo',
    'telecel_cash',
    'airteltigo',
    'visa',
    'mastercard',
    'cash',
    'bank_transfer',
  ]),
  markAsPaid: z.boolean().default(false),
  includeTax: z.boolean().default(false),
  billToSameAsGuest: z.boolean().optional(),
  billToName: z.string().max(120).optional().or(z.literal('')),
})

const partialPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
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

const refundSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
  reason: z.string().max(200).optional(),
})

const issueStayInvoiceSchema = z
  .object({
    reservationId: z.string().uuid(),
    paymentMethod: z.enum([
      'mtn_momo',
      'telecel_cash',
      'airteltigo',
      'visa',
      'mastercard',
      'cash',
      'bank_transfer',
    ]),
    markAsPaid: z.boolean().default(false),
    includeTax: z.boolean().default(false),
    billToSameAsGuest: z.boolean().optional(),
    billToName: z.string().max(120).optional().or(z.literal('')),
    discountType: z.enum(['none', 'percent', 'fixed']).optional(),
    discountValue: z.coerce.number().min(0).optional(),
    discountReason: z.string().max(200).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === 'percent' && (data.discountValue ?? 0) > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percent discount cannot exceed 100%.',
        path: ['discountValue'],
      })
    }
  })

const collectStayPaymentSchema = z.object({
  reservationId: z.string().uuid(),
  paymentMethod: z.enum([
    'mtn_momo',
    'telecel_cash',
    'airteltigo',
    'visa',
    'mastercard',
    'cash',
    'bank_transfer',
  ]),
  includeTax: z.boolean().default(false),
  paymentAmount: z.coerce.number().min(0).optional(),
  payFullBalance: z.boolean().default(false),
  skipPayment: z.boolean().default(false),
  waiveMinimum: z.boolean().default(false),
})

async function requireOwnerBilling() {
  const result = await requireVerifiedStaff({ roles: ['owner'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  return result.profile
}

async function requireManualInvoiceStaff() {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  if (!canCreateManualInvoice(result.profile.role)) return null
  return result.profile
}

async function requirePaymentStaff() {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager', 'receptionist'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  if (!canRecordInvoicePayment(result.profile.role)) return null
  return result.profile
}

function revalidateBilling() {
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/reservations')
  revalidatePath('/manager/invoices')
  revalidatePath('/manager/reservations')
  revalidatePath('/receptionist/billing')
  revalidatePath('/receptionist/reservations')
}

async function requireInvoiceViewer() {
  const result = await requireVerifiedStaff({ roles: ['owner', 'manager', 'receptionist'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
  return result.profile
}

export async function getStaffInvoiceExport(invoiceId: string): Promise<StaffInvoiceExportResult> {
  const profile = await requireInvoiceViewer()
  if (!profile?.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('invoices')
    .select(
      '*, hotels(name, address, city, region, vat_registration_number, vat_mode, notification_from_email, guest_portal_emergency_phone), reservations(check_in, check_out, rooms(number, room_categories(name)))',
    )
    .eq('id', invoiceId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!row) return { success: false, error: 'Invoice not found.' }

  const hotelRaw = row.hotels as {
    name: string
    address: string | null
    city: string | null
    region: string | null
    vat_registration_number: string | null
    vat_mode: 'exclusive' | 'inclusive' | null
    notification_from_email: string | null
    guest_portal_emergency_phone: string | null
  } | null

  let guestPhone: string | null = null
  if (row.guest_id) {
    const { data: guestRow } = await admin
      .from('guests')
      .select('phone')
      .eq('id', row.guest_id)
      .maybeSingle()
    guestPhone = guestRow?.phone?.trim() || null
  }

  const reservation = row.reservations as unknown as {
    check_in: string
    check_out: string
    rooms?: { number: string; room_categories?: { name: string } | null } | null
  } | null

  const checkIn = reservation?.check_in ?? null
  const checkOut = reservation?.check_out ?? null

  return {
    success: true,
    data: {
      hotel: withInvoiceHotelContact({
        name: hotelRaw?.name ?? 'Property',
        address: hotelRaw?.address ?? null,
        city: hotelRaw?.city ?? null,
        region: hotelRaw?.region ?? null,
        phone: hotelRaw?.guest_portal_emergency_phone ?? null,
        email: hotelRaw?.notification_from_email ?? null,
        vatRegistrationNumber: hotelRaw?.vat_registration_number ?? null,
        vatMode: hotelRaw?.vat_mode ?? 'exclusive',
      }),
      invoice: {
        invoiceNumber: formatInvoiceNumber({ invoice_number: row.invoice_number, id: row.id }),
        guestName: row.guest_name,
        billToName: row.bill_to_name ?? null,
        guestPhone,
        roomNumber: reservation?.rooms?.number ?? null,
        roomCategoryName:
          row.room_category_name?.trim() ||
          reservation?.rooms?.room_categories?.name?.trim() ||
          null,
        checkIn,
        checkOut,
        nights: checkIn && checkOut ? stayNights(checkIn, checkOut) : null,
        issuedAt: row.issued_at,
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discount_amount ?? 0),
        discountReason: row.discount_reason ?? null,
        nhil: Number(row.nhil_amount ?? 0),
        getfund: Number(row.getfund_amount ?? 0),
        covid: Number(row.covid_levy_amount ?? 0),
        vat: Number(row.vat_amount ?? 0),
        elevy: Number(row.elevy_amount ?? 0),
        tourism: Number(row.tourism_levy_amount ?? 0),
        taxSnapshot: parseTaxSnapshot(row.tax_snapshot),
        guestTaxId: row.guest_tax_id ?? null,
        total: Number(row.total_amount),
        amountPaid: Number(row.amount_paid ?? 0),
        paymentMethod: row.payment_method,
        paymentStatus: row.payment_status,
      },
    },
  }
}

function dueDateISO(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

async function applyInvoicePayment(input: {
  invoiceId: string
  hotelId: string
  amount: number
  paymentMethod: PaymentMethod
  provider: 'manual'
  providerReference?: string
  actorId?: string
  actorName?: string
  phase?: 'in_stay' | 'checkout'
}): Promise<InvoiceActionResult> {
  const admin = createAdminClient()
  const idempotencyKey =
    input.providerReference != null
      ? `${input.provider}:${input.providerReference}`
      : `${input.provider}:${input.invoiceId}:${Date.now()}:${input.amount}`

  const { data: invoice } = await admin
    .from('invoices')
    .select('guest_name, payment_status, reservation_id')
    .eq('id', input.invoiceId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!invoice) return { success: false, error: 'Invoice not found.' }

  let result:
    | Awaited<ReturnType<typeof applyStayPayment>>
    | Awaited<ReturnType<typeof applyInvoicePaymentRecord>>

  if (invoice.reservation_id) {
    result = await applyStayPayment(admin, {
      hotelId: input.hotelId,
      invoiceId: input.invoiceId,
      reservationId: invoice.reservation_id,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      provider: input.provider,
      providerReference: input.providerReference,
      idempotencyKey,
      metadata: { source: 'billing' },
      phase: input.phase ?? 'in_stay',
    })
  } else {
    result = await applyInvoicePaymentRecord(admin, {
      invoiceId: input.invoiceId,
      hotelId: input.hotelId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      provider: input.provider,
      providerReference: input.providerReference,
      idempotencyKey,
      metadata: { source: 'billing' },
    })
  }

  if (!result.ok) return { success: false, error: result.error }

  if (input.actorId && invoice) {
    void writeAuditLog({
      hotelId: input.hotelId,
      actorId: input.actorId,
      actorName: input.actorName ?? 'Staff',
      entityType: 'invoice',
      entityId: input.invoiceId,
      action: 'payment',
      summary: `Payment recorded on ${invoice.guest_name} invoice`,
    })
  }

  revalidateBilling()
  return { success: true }
}

export async function recordInvoicePayment(
  invoiceId: string,
  paymentMethod?: PaymentMethod,
): Promise<InvoiceActionResult> {
  const profile = await requirePaymentStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, total_amount, amount_paid, payment_status')
    .eq('id', invoiceId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!invoice) return { success: false, error: 'Invoice not found.' }

  const balance = invoiceBalanceDue(
    Number(invoice.total_amount ?? 0),
    Number(invoice.amount_paid ?? 0),
  )

  return applyInvoicePayment({
    invoiceId,
    hotelId: profile.hotel_id,
    amount: balance,
    paymentMethod: paymentMethod ?? 'cash',
    provider: 'manual',
    actorId: profile.id,
    actorName: profile.name,
  })
}

export async function recordPartialInvoicePayment(
  input: unknown,
): Promise<InvoiceActionResult> {
  const parsed = partialPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payment.' }
  }

  const profile = await requirePaymentStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  return applyInvoicePayment({
    invoiceId: parsed.data.invoiceId,
    hotelId: profile.hotel_id,
    amount: parsed.data.amount,
    paymentMethod: parsed.data.paymentMethod,
    provider: 'manual',
    providerReference: parsed.data.reference,
    actorId: profile.id,
    actorName: profile.name,
  })
}

export async function refundInvoicePayment(input: unknown): Promise<InvoiceActionResult> {
  const parsed = refundSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid refund.' }
  }

  const profile = await requireOwnerBilling()
  if (!profile?.hotel_id || !canRefundInvoice(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, guest_id, guest_name, reservation_id, total_amount, amount_paid, payment_status')
    .eq('id', parsed.data.invoiceId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!invoice) return { success: false, error: 'Invoice not found.' }

  const paid = Number(invoice.amount_paid ?? 0)
  if (paid <= 0 && invoice.payment_status !== 'paid') {
    return { success: false, error: 'No payment to refund on this invoice.' }
  }

  const refundAmount = parsed.data.amount ?? paid
  if (refundAmount <= 0 || refundAmount > paid + 0.01) {
    return { success: false, error: 'Refund amount exceeds amount paid.' }
  }

  // Refund to source via Paystack when online charges exist; fail closed if PSP refund fails.
  const online = await refundOnlineInvoicePayments(admin, {
    hotelId: profile.hotel_id,
    invoiceId: parsed.data.invoiceId,
    amountGhs: refundAmount,
    reason: parsed.data.reason,
  })
  if (!online.ok) {
    return { success: false, error: online.error }
  }

  const now = new Date().toISOString()
  const idempotencyKey = `refund:${parsed.data.invoiceId}:${randomUUID()}`

  await admin.from('payment_records').insert({
    hotel_id: profile.hotel_id,
    invoice_id: parsed.data.invoiceId,
    guest_id: invoice.guest_id,
    provider: online.refundedOnlineGhs > 0.009 ? 'paystack' : 'manual',
    provider_reference:
      online.references[0] ?? parsed.data.reason ?? 'Refund',
    amount: -refundAmount,
    currency: 'GHS',
    status: 'refunded',
    idempotency_key: idempotencyKey,
    completed_at: now,
    metadata: {
      reason: parsed.data.reason ?? null,
      refunded_online_ghs: online.refundedOnlineGhs,
      online_references: online.references,
    },
  })

  const newPaid = Math.max(0, Math.round((paid - refundAmount) * 100) / 100)
  const newStatus: 'refunded' | 'partial' | 'pending' =
    newPaid <= 0 ? 'refunded' : 'partial'

  const { error } = await admin
    .from('invoices')
    .update({
      amount_paid: newPaid,
      payment_status: newStatus,
      paid_at: null,
    })
    .eq('id', parsed.data.invoiceId)

  if (error) return { success: false, error: error.message }

  if (invoice.reservation_id) {
    await syncReservationPaymentFromInvoice(admin, invoice.reservation_id)
  }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'invoice',
    entityId: parsed.data.invoiceId,
    action: 'refund',
    summary: `Refunded ₵${refundAmount} on ${invoice.guest_name} invoice`,
    details: {
      reason: parsed.data.reason,
      refundedOnlineGhs: online.refundedOnlineGhs,
      onlineReferences: online.references,
    },
  })

  revalidateBilling()
  return { success: true }
}

export async function issueStayInvoice(input: unknown): Promise<IssueStayInvoiceResult> {
  const parsed = issueStayInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const result = await requireVerifiedStaff({ roles: ['owner', 'manager', 'receptionist'] })
  const hotelId = result.ok ? result.profile.hotel_id : null
  if (!result.ok || !hotelId || !canIssueStayInvoice(result.profile.role)) {
    return { success: false, error: result.ok ? 'Not authorized.' : (result.error ?? 'Not authorized.') }
  }
  const profile = result.profile

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select(
      'id, hotel_id, guest_id, guest_name, room_id, check_in, check_out, rate_type, nightly_rate, weekly_rate, monthly_rate, total_amount, amount_paid, payment_method, status, discount_type, discount_value, discount_amount, discount_reason',
    )
    .eq('id', parsed.data.reservationId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }

  const markAsPaid =
    canIssueUnpaidStayInvoice(profile.role) ? parsed.data.markAsPaid : true

  // Pay-before-enter: allow invoice + collect on confirmed bookings before check-in.
  const issuable = [
    'confirmed',
    'pre_arrival',
    'provisional',
    'checked_in',
    'overstay',
    'checkout_in_progress',
  ]
  if (!issuable.includes(reservation.status ?? '')) {
    return {
      success: false,
      error: 'Issue invoices for upcoming or in-house stays only.',
    }
  }

  let stayReservation = reservation
  if (parsed.data.discountType !== undefined) {
    if (!canApplyGuestDiscount(profile.role)) {
      return { success: false, error: 'Only managers and owners can apply guest discounts.' }
    }
    const discountType = normalizeDiscountType(parsed.data.discountType)
    const discountValue = parsed.data.discountValue ?? 0
    let roomBase = Number(reservation.total_amount ?? 0)
    if (reservation.room_id) {
      const rateType = (reservation.rate_type ?? 'nightly') as RateType
      const roomRates = await getRoomRates(admin, reservation.room_id)
      roomBase = calculateStayTotal(
        rateType,
        reservation.check_in,
        reservation.check_out,
        reservation.nightly_rate != null
          ? Number(reservation.nightly_rate)
          : roomRates.nightlyRate,
        reservation.monthly_rate != null
          ? Number(reservation.monthly_rate)
          : roomRates.monthlyRate,
        reservation.weekly_rate != null
          ? Number(reservation.weekly_rate)
          : roomRates.weeklyRate,
      )
    }
    const discountAmount = computeDiscountAmount(roomBase, discountType, discountValue)
    const discountReason =
      discountAmount > 0 ? (parsed.data.discountReason?.trim() || null) : null

    const { error: discountError } = await admin
      .from('reservations')
      .update({
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        discount_reason: discountReason,
      })
      .eq('id', reservation.id)
      .eq('hotel_id', hotelId)

    if (discountError) {
      return { success: false, error: discountError.message }
    }

    stayReservation = {
      ...reservation,
      discount_type: discountType,
      discount_value: discountValue,
      discount_amount: discountAmount,
      discount_reason: discountReason,
    }
  }

  let guestPhone: string | null = null
  let roomNumber: string | null = null
  if (stayReservation.guest_id) {
    const { data: guestRow } = await admin
      .from('guests')
      .select('phone')
      .eq('id', stayReservation.guest_id)
      .maybeSingle()
    guestPhone = guestRow?.phone?.trim() ?? null
  }
  if (stayReservation.room_id) {
    const { data: roomRow } = await admin
      .from('rooms')
      .select('number')
      .eq('id', stayReservation.room_id)
      .maybeSingle()
    roomNumber = roomRow?.number ?? null
  }

  try {
    const issued = await createOrRefreshStayInvoice(admin, {
      reservation: stayReservation,
      paymentMethod: parsed.data.paymentMethod,
      markAsPaid,
      includeTax: parsed.data.includeTax,
      guestPhone,
      roomNumber,
      billToSameAsGuest: parsed.data.billToSameAsGuest,
      billToName: parsed.data.billToName,
    })

    void writeAuditLog({
      hotelId,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'invoice',
      entityId: issued.invoiceId,
      action: issued.created ? 'created' : 'updated',
      summary: `${issued.created ? 'Issued' : 'Refreshed'} stay invoice ${issued.invoiceNumber} for ${stayReservation.guest_name}${
        issued.discountAmount > 0 ? ` (discount ₵${issued.discountAmount})` : ''
      }${markAsPaid ? '' : ' (unpaid)'}`,
    })

    revalidateBilling()
    return {
      success: true,
      invoiceId: issued.invoiceId,
      invoicePreview: issued.invoicePreview,
      created: issued.created,
      paymentStatus: issued.paymentStatus,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not issue invoice.',
    }
  }
}

function reservationNightlyRate(reservation: {
  nightly_rate: number | null
  total_amount: number | null
  check_in: string
  check_out: string
}): number {
  if (reservation.nightly_rate != null && Number(reservation.nightly_rate) > 0) {
    return Number(reservation.nightly_rate)
  }
  const nights = stayNights(reservation.check_in, reservation.check_out)
  const total = Number(reservation.total_amount ?? 0)
  return nights > 0 ? total / nights : total
}

export async function getStayCollectContext(
  reservationId: string,
): Promise<StayCollectContextResult> {
  const profile = await requirePaymentStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select(
      'id, hotel_id, check_in, check_out, nightly_rate, total_amount, amount_paid, payment_status, channel',
    )
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }

  const { data: invoice } = await admin
    .from('invoices')
    .select('total_amount, amount_paid')
    .eq('reservation_id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  const policy = await getHotelCheckInPaymentPolicy(profile.hotel_id)
  const invoiceTotal = Number(invoice?.total_amount ?? reservation.total_amount ?? 0)
  const amountPaid = Number(invoice?.amount_paid ?? reservation.amount_paid ?? 0)
  const nights = stayNights(reservation.check_in, reservation.check_out)
  const nightlyRate = reservationNightlyRate(reservation)
  const requiredMinimum = requiredPaymentAtCheckIn({
    invoiceTotal,
    nights,
    nightlyRate,
    mode: policy.mode,
    value: policy.value,
  })
  const channelPrepaid = isChannelPrepaidStay({
    channel: reservation.channel,
    paymentStatus: reservation.payment_status,
    amountPaid,
    requiredMinimum,
  })
  const minimumAlreadyMet = assertCheckInPaymentMet({
    invoiceTotal,
    nights,
    nightlyRate,
    mode: policy.mode,
    value: policy.value,
    amountPaid,
    complimentary: invoiceTotal <= 0,
    channelPrepaid,
  }).ok

  return {
    success: true,
    data: {
      requiredMinimum,
      balanceDue: invoiceBalanceDue(invoiceTotal, amountPaid),
      amountPaid,
      invoiceTotal,
      canWaiveMinimum: canIssueUnpaidStayInvoice(profile.role),
      policyLabel: formatCheckInPaymentPolicyLabel(policy),
      channelPrepaid,
      minimumAlreadyMet,
    },
  }
}

export async function getStayPaymentHistoryForStay(
  reservationId: string,
  invoiceId?: string,
): Promise<StayPaymentHistoryResult> {
  const profile = await requirePaymentStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select('id')
    .eq('id', reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }

  const rows = await getStayPaymentHistory(admin, profile.hotel_id, {
    reservationId,
    invoiceId,
  })
  return { success: true, data: rows }
}

export async function collectStayPayment(input: unknown): Promise<CollectStayPaymentResult> {
  const parsed = collectStayPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payment.' }
  }

  const profile = await requirePaymentStaff()
  if (!profile?.hotel_id || !canRecordInvoicePayment(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: reservation } = await admin
    .from('reservations')
    .select(
      'id, hotel_id, guest_id, guest_name, room_id, check_in, check_out, rate_type, nightly_rate, weekly_rate, monthly_rate, total_amount, amount_paid, payment_method, payment_status, status, channel, discount_type, discount_value, discount_amount, discount_reason',
    )
    .eq('id', parsed.data.reservationId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!reservation) return { success: false, error: 'Reservation not found.' }

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

  const policy = await getHotelCheckInPaymentPolicy(profile.hotel_id)
  const canWaive = canIssueUnpaidStayInvoice(profile.role)

  if (parsed.data.waiveMinimum && !canWaive) {
    return { success: false, error: 'Only managers and owners can waive the check-in minimum.' }
  }

  if (parsed.data.skipPayment && !canWaive && !parsed.data.waiveMinimum) {
    return {
      success: false,
      error: 'Reception must collect at least the check-in minimum before the guest enters.',
    }
  }

  let issued: Awaited<ReturnType<typeof createOrRefreshStayInvoice>>
  try {
    issued = await createOrRefreshStayInvoice(admin, {
      reservation,
      paymentMethod: parsed.data.paymentMethod,
      markAsPaid: false,
      includeTax: parsed.data.includeTax,
      guestPhone,
      roomNumber,
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not refresh stay invoice.',
    }
  }

  const invoiceTotal = issued.taxes.total
  let amountPaid = issued.amountPaid
  const nights = stayNights(reservation.check_in, reservation.check_out)
  const nightlyRate = reservationNightlyRate(reservation)
  const requiredMinimum = requiredPaymentAtCheckIn({
    invoiceTotal,
    nights,
    nightlyRate,
    mode: policy.mode,
    value: policy.value,
  })

  const evaluatePayment = () => {
    const channelPrepaid = isChannelPrepaidStay({
      channel: reservation.channel,
      paymentStatus: reservation.payment_status,
      amountPaid,
      requiredMinimum,
    })
    return assertCheckInPaymentMet({
      invoiceTotal,
      nights,
      nightlyRate,
      mode: policy.mode,
      value: policy.value,
      amountPaid,
      complimentary: invoiceTotal <= 0,
      channelPrepaid,
      managerOverride: parsed.data.waiveMinimum && canWaive,
    })
  }

  if (parsed.data.skipPayment) {
    const check = evaluatePayment()
    if (!check.ok) {
      return { success: false, error: check.error }
    }

    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'invoice',
      entityId: issued.invoiceId,
      action: 'updated',
      summary: `Stay invoice ${issued.invoiceNumber} — continued without payment${
        parsed.data.waiveMinimum ? ' (minimum waived)' : ''
      }`,
    })

    revalidateBilling()
    return {
      success: true,
      invoiceId: issued.invoiceId,
      invoicePreview: issued.invoicePreview,
      created: issued.created,
      paymentStatus: issued.paymentStatus,
      amountApplied: 0,
      balanceDue: invoiceBalanceDue(invoiceTotal, amountPaid),
      requiredMinimum,
    }
  }

  const balanceDue = invoiceBalanceDue(invoiceTotal, amountPaid)
  const payAmount = parsed.data.payFullBalance
    ? balanceDue
    : Math.min(parsed.data.paymentAmount ?? 0, balanceDue)

  if (payAmount <= 0.009) {
    const check = evaluatePayment()
    if (!check.ok) {
      return {
        success: false,
        error:
          check.error ??
          'Enter a payment amount or collect the check-in minimum before the guest enters.',
      }
    }

    revalidateBilling()
    return {
      success: true,
      invoiceId: issued.invoiceId,
      invoicePreview: issued.invoicePreview,
      created: issued.created,
      paymentStatus: issued.paymentStatus,
      amountApplied: 0,
      balanceDue,
      requiredMinimum,
    }
  }

  const paymentResult = await applyStayPayment(admin, {
    hotelId: profile.hotel_id,
    reservationId: reservation.id,
    invoiceId: issued.invoiceId,
    amount: payAmount,
    paymentMethod: parsed.data.paymentMethod,
    provider: 'manual',
    idempotencyKey: `collect-stay:${issued.invoiceId}:${randomUUID()}`,
    phase: 'check_in',
    metadata: { source: 'check_in_collect' },
  })

  if (!paymentResult.ok) {
    return { success: false, error: paymentResult.error }
  }

  const { data: updatedInvoice } = await admin
    .from('invoices')
    .select('amount_paid, payment_status')
    .eq('id', issued.invoiceId)
    .maybeSingle()
  amountPaid = Number(updatedInvoice?.amount_paid ?? amountPaid)

  const { data: updatedReservation } = await admin
    .from('reservations')
    .select('payment_status')
    .eq('id', reservation.id)
    .maybeSingle()

  const check = assertCheckInPaymentMet({
    invoiceTotal,
    nights,
    nightlyRate,
    mode: policy.mode,
    value: policy.value,
    amountPaid,
    complimentary: invoiceTotal <= 0,
    channelPrepaid: isChannelPrepaidStay({
      channel: reservation.channel,
      paymentStatus: updatedReservation?.payment_status ?? reservation.payment_status,
      amountPaid,
      requiredMinimum,
    }),
    managerOverride: parsed.data.waiveMinimum && canWaive,
  })
  if (!check.ok) {
    return { success: false, error: check.error }
  }

  const refreshed = await getStaffInvoiceExport(issued.invoiceId)
  const invoicePreview = refreshed.success ? refreshed.data.invoice : issued.invoicePreview

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'invoice',
    entityId: issued.invoiceId,
    action: 'updated',
    summary: `Collected ₵${paymentResult.amountApplied.toFixed(2)} on stay invoice ${issued.invoiceNumber} at check-in`,
  })

  revalidateBilling()
  return {
    success: true,
    invoiceId: issued.invoiceId,
    invoicePreview,
    created: issued.created,
    paymentStatus: paymentResult.paymentStatus as PaymentStatus,
    amountApplied: paymentResult.amountApplied,
    balanceDue: paymentResult.balanceDue,
    requiredMinimum,
  }
}

export async function createManualInvoice(
  input: z.infer<typeof createManualInvoiceSchema>,
): Promise<InvoiceActionResult> {
  const parsed = createManualInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const profile = await requireManualInvoiceStaff()
  if (!profile?.hotel_id || !canCreateManualInvoice(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { vatMode, rates } = await getHotelTaxConfig(profile.hotel_id)
  const taxes = computeInvoiceTaxesWithOption(
    parsed.data.subtotal,
    vatMode,
    parsed.data.includeTax,
    rates,
  )
  const now = new Date().toISOString()
  const paidNow = parsed.data.markAsPaid
  const invoiceNumber = await allocateInvoiceNumber(profile.hotel_id)

  const guestTaxId = resolveInvoiceTaxId(parsed.data.includeTax)
  const billTo = resolveBillToName({
    guestName: parsed.data.guestName,
    billToSameAsGuest: parsed.data.billToSameAsGuest,
    billToName: parsed.data.billToName,
  })
  if (!billTo.ok) {
    return { success: false, error: billTo.error }
  }

  const { error } = await admin.from('invoices').insert({
    hotel_id: profile.hotel_id,
    guest_id: parsed.data.guestId ?? null,
    guest_name: parsed.data.guestName.trim(),
    bill_to_name: billTo.value,
    invoice_number: invoiceNumber,
    subtotal: taxes.subtotal,
    nhil_amount: taxes.nhil,
    getfund_amount: taxes.getfund,
    covid_levy_amount: taxes.covid,
    vat_amount: taxes.vat,
    elevy_amount: taxes.elevy,
    tourism_levy_amount: taxes.tourism,
    tax_snapshot: taxSnapshotFromRates(rates),
    guest_tax_id: guestTaxId,
    total_amount: taxes.total,
    payment_method: parsed.data.paymentMethod,
    payment_status: paidNow ? 'paid' : 'pending',
    amount_paid: paidNow ? taxes.total : 0,
    issued_at: now,
    due_at: paidNow ? now : dueDateISO(7),
    paid_at: paidNow ? now : null,
  })

  if (error) return { success: false, error: error.message }

  revalidateBilling()
  return { success: true }
}

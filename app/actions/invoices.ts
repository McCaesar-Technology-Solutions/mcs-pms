'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { requireVerifiedStaff, consumeStaffAuthError } from '@/lib/auth/staff-session'
import {
  canApplyGuestDiscount,
  canCreateManualInvoice,
  canIssueStayInvoice,
  canOmitInvoiceTax,
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
import { getHotelTaxConfig } from '@/lib/data/settings'
import {
  invoiceBalanceDue,
} from '@/lib/billing/invoice-payments'
import { applyInvoicePaymentRecord } from '@/lib/billing/apply-payment'
import { createOrRefreshStayInvoice } from '@/lib/billing/build-stay-invoice'
import { computeDiscountAmount, normalizeDiscountType } from '@/lib/billing/discount'
import { syncReservationPaymentFromInvoice } from '@/lib/billing/reservation-payment'
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
  markAsPaid: z.boolean().default(true),
  includeTax: z.boolean().default(true),
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
    includeTax: z.boolean().default(true),
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

async function requireOwnerBilling() {
  const result = await requireVerifiedStaff({ roles: ['owner'] })
  if (!result.ok) return null
  if (!result.profile.hotel_id) return null
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
    return { success: false, error: consumeStaffAuthError() ?? 'Not authorized.' }
  }

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('invoices')
    .select(
      '*, hotels(name, address, city, region, vat_registration_number, vat_mode, notification_from_email, guest_portal_emergency_phone), reservations(check_in, check_out, rooms(number))',
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
    rooms?: { number: string } | null
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
        guestPhone,
        roomNumber: reservation?.rooms?.number ?? null,
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
}): Promise<InvoiceActionResult> {
  const admin = createAdminClient()
  const idempotencyKey =
    input.providerReference != null
      ? `${input.provider}:${input.providerReference}`
      : `${input.provider}:${input.invoiceId}:${Date.now()}:${input.amount}`

  const { data: invoice } = await admin
    .from('invoices')
    .select('guest_name, payment_status')
    .eq('id', input.invoiceId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  const result = await applyInvoicePaymentRecord(admin, {
    invoiceId: input.invoiceId,
    hotelId: input.hotelId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    provider: input.provider,
    providerReference: input.providerReference,
    idempotencyKey,
  })

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
    return { success: false, error: consumeStaffAuthError() ?? 'Not authorized.' }
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

  const issuable = ['checked_in', 'overstay', 'checkout_in_progress']
  if (!issuable.includes(reservation.status ?? '')) {
    return {
      success: false,
      error: 'Issue invoices for in-house stays only (after check-in).',
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

  // Front desk always issues GRA tax invoices; only manager/owner may omit tax.
  const includeTax = canOmitInvoiceTax(profile.role) ? parsed.data.includeTax : true

  try {
    const issued = await createOrRefreshStayInvoice(admin, {
      reservation: stayReservation,
      paymentMethod: parsed.data.paymentMethod,
      markAsPaid: parsed.data.markAsPaid,
      includeTax,
      guestPhone,
      roomNumber,
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
      }`,
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

export async function createManualInvoice(
  input: z.infer<typeof createManualInvoiceSchema>,
): Promise<InvoiceActionResult> {
  const parsed = createManualInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const profile = await requireOwnerBilling()
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

  const { error } = await admin.from('invoices').insert({
    hotel_id: profile.hotel_id,
    guest_id: parsed.data.guestId ?? null,
    guest_name: parsed.data.guestName.trim(),
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

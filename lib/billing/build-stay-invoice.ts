import type { createAdminClient } from '@/lib/supabase/admin'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import { getHotelTaxConfig } from '@/lib/data/settings'
import {
  computeInvoiceTaxes,
  noTaxInvoice,
  resolveInvoiceTaxRates,
  type HotelTaxRates,
  type InvoiceTaxes,
  type VatMode,
} from '@/lib/tax'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
import { getRoomRates } from '@/lib/pricing/room-rates'
import {
  linkFolioChargesToInvoice,
  prepareCheckoutTaxesWithFolio,
} from '@/lib/folio/rollup'
import { buildCheckoutInvoicePreview } from '@/lib/billing/checkout-invoice-export'
import {
  applyDiscountToBase,
  normalizeDiscountType,
  type DiscountType,
} from '@/lib/billing/discount'
import { resolveInvoiceTaxId } from '@/lib/billing/ghana-card'
import {
  buildCheckoutInvoicePaymentState,
  finalizeReservationCheckoutPayment,
  linkDepositRecordsToInvoice,
  syncReservationPaymentFromInvoice,
} from '@/lib/billing/reservation-payment'
import { deriveInvoicePaymentStatus, invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import type { InvoiceExportRow } from '@/lib/export/types'
import type { PaymentMethod, PaymentStatus } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

export interface StayInvoiceReservation {
  id: string
  hotel_id: string
  guest_id: string | null
  guest_name: string
  room_id: string | null
  check_in: string
  check_out: string
  rate_type: string | null
  nightly_rate: number | null
  weekly_rate: number | null
  monthly_rate: number | null
  total_amount: number | null
  amount_paid: number | null
  payment_method?: string | null
  discount_type?: string | null
  discount_value?: number | null
  discount_amount?: number | null
  discount_reason?: string | null
}

async function computeRoomChargeAmount(
  admin: AdminClient,
  reservation: StayInvoiceReservation,
  effectiveCheckOut: string,
): Promise<number> {
  // Prefer rate math so invoice refresh stays correct after sync sets total_amount to gross.
  if (reservation.room_id) {
    const rateType = (reservation.rate_type ?? 'nightly') as RateType
    const roomRates = await getRoomRates(admin, reservation.room_id)
    const nightlyRate =
      reservation.nightly_rate != null ? Number(reservation.nightly_rate) : roomRates.nightlyRate
    const weeklyRate =
      reservation.weekly_rate != null ? Number(reservation.weekly_rate) : roomRates.weeklyRate
    const monthlyRate =
      reservation.monthly_rate != null ? Number(reservation.monthly_rate) : roomRates.monthlyRate
    return calculateStayTotal(
      rateType,
      reservation.check_in,
      effectiveCheckOut,
      nightlyRate,
      monthlyRate,
      weeklyRate,
    )
  }

  return Math.max(0, Number(reservation.total_amount ?? 0))
}

async function computeRoomTaxesForStay(
  admin: AdminClient,
  reservation: StayInvoiceReservation,
  effectiveCheckOut: string,
  includeTax: boolean,
  vatMode: VatMode,
  rates: HotelTaxRates,
): Promise<{
  taxes: InvoiceTaxes
  discountAmount: number
  roomListBase: number
}> {
  const roomListBase = await computeRoomChargeAmount(admin, reservation, effectiveCheckOut)
  const discountType = normalizeDiscountType(reservation.discount_type) as DiscountType
  const { taxableBase, discountAmount } = applyDiscountToBase(
    roomListBase,
    discountType,
    reservation.discount_value,
  )

  const taxes = !includeTax
    ? noTaxInvoice(taxableBase)
    : computeInvoiceTaxes(taxableBase, vatMode, rates)

  return { taxes, discountAmount, roomListBase }
}

function invoiceDiscountFields(
  discountAmount: number,
  reason: string | null | undefined,
): { discount_amount: number; discount_reason: string | null } {
  return {
    discount_amount: discountAmount,
    discount_reason: discountAmount > 0 ? (reason?.trim() || null) : null,
  }
}

/**
 * Create a stay-linked invoice or refresh an existing one (folio + stay total).
 * Idempotent per reservation_id. Safe for check-in issue and checkout reuse.
 */
export async function createOrRefreshStayInvoice(
  admin: AdminClient,
  input: {
    reservation: StayInvoiceReservation
    paymentMethod: PaymentMethod
    markAsPaid: boolean
    includeTax?: boolean
    effectiveCheckOut?: string
    guestPhone?: string | null
    roomNumber?: string | null
  },
): Promise<{
  invoiceId: string
  invoiceNumber: string
  taxes: InvoiceTaxes
  folioSubtotal: number
  discountAmount: number
  created: boolean
  invoicePreview: InvoiceExportRow
  paymentStatus: PaymentStatus
  amountPaid: number
}> {
  const includeTax = input.includeTax !== false
  const effectiveCheckOut = input.effectiveCheckOut ?? input.reservation.check_out
  const reservation = input.reservation
  const now = new Date().toISOString()
  const paidNow = input.markAsPaid

  const { data: existing } = await admin
    .from('invoices')
    .select('id, invoice_number, amount_paid, payment_status, paid_at, guest_tax_id, tax_snapshot')
    .eq('reservation_id', reservation.id)
    .eq('hotel_id', reservation.hotel_id)
    .maybeSingle()

  const { vatMode, rates: hotelRates } = await getHotelTaxConfig(reservation.hotel_id)
  // Freeze rates after first issue so owner rate edits do not rewrite in-flight invoices.
  const { rates, snapshot: taxSnapshot } = resolveInvoiceTaxRates(
    existing?.tax_snapshot,
    hotelRates,
  )

  const { taxes: roomTaxes, discountAmount } = await computeRoomTaxesForStay(
    admin,
    reservation,
    effectiveCheckOut,
    includeTax,
    vatMode,
    rates,
  )

  const discountFields = invoiceDiscountFields(discountAmount, reservation.discount_reason)

  // Persist computed discount_amount on the reservation for UI consistency
  if (Math.abs(Number(reservation.discount_amount ?? 0) - discountAmount) > 0.009) {
    await admin
      .from('reservations')
      .update({ discount_amount: discountAmount })
      .eq('id', reservation.id)
      .eq('hotel_id', reservation.hotel_id)
  }

  const { taxes, folioCharges, folioSubtotal } = reservation.guest_id
    ? await prepareCheckoutTaxesWithFolio(
        admin,
        reservation.hotel_id,
        reservation.guest_id,
        reservation.id,
        roomTaxes,
        includeTax,
        rates,
      )
    : { taxes: roomTaxes, folioCharges: [] as Array<{ id: string }>, folioSubtotal: 0 }

  const taxPersist = {
    nhil_amount: taxes.nhil,
    getfund_amount: taxes.getfund,
    covid_levy_amount: taxes.covid,
    vat_amount: taxes.vat,
    elevy_amount: taxes.elevy,
    tourism_levy_amount: taxes.tourism,
    tax_snapshot: taxSnapshot,
  }

  // Hotel policy: every taxed invoice uses the fixed Bill-to Tax ID.
  const guestTaxId = resolveInvoiceTaxId(includeTax)

  const previewBase = {
    guestName: reservation.guest_name,
    guestPhone: input.guestPhone ?? null,
    guestTaxId,
    roomNumber: input.roomNumber ?? null,
    checkIn: reservation.check_in,
    checkOut: effectiveCheckOut,
    issuedAt: now,
    subtotal: taxes.subtotal,
    discountAmount,
    discountReason: discountFields.discount_reason,
    nhil: taxes.nhil,
    getfund: taxes.getfund,
    covid: taxes.covid,
    vat: taxes.vat,
    elevy: taxes.elevy,
    tourism: taxes.tourism,
    taxSnapshot,
    total: taxes.total,
    paymentMethod: input.paymentMethod,
  }

  if (existing) {
    const priorPaid = Math.max(0, Number(existing.amount_paid ?? 0))
    let amountPaid = priorPaid
    let paymentStatus = deriveInvoicePaymentStatus(
      taxes.total,
      amountPaid,
      existing.payment_status as PaymentStatus,
    )

    if (paidNow) {
      const balance = invoiceBalanceDue(taxes.total, priorPaid)
      amountPaid = taxes.total
      paymentStatus = 'paid'

      await admin
        .from('invoices')
        .update({
          subtotal: taxes.subtotal,
          ...discountFields,
          ...taxPersist,
          guest_tax_id: guestTaxId,
          total_amount: taxes.total,
          payment_method: input.paymentMethod,
          payment_status: paymentStatus,
          amount_paid: amountPaid,
          due_at: now,
          paid_at: now,
        })
        .eq('id', existing.id)
        .eq('hotel_id', reservation.hotel_id)

      if (folioCharges.length) {
        await linkFolioChargesToInvoice(
          admin,
          folioCharges.map((c) => c.id),
          existing.id,
        )
      }

      await linkDepositRecordsToInvoice(admin, reservation.id, existing.id)

      if (balance > 0.009) {
        await admin.from('payment_records').insert({
          hotel_id: reservation.hotel_id,
          invoice_id: existing.id,
          reservation_id: reservation.id,
          guest_id: reservation.guest_id,
          provider: 'manual',
          amount: balance,
          currency: 'GHS',
          status: 'success',
          idempotency_key: `stay-invoice-balance:${existing.id}:${now}`,
          completed_at: now,
          metadata: { source: 'stay_invoice_balance' },
        })
      }

      await syncReservationPaymentFromInvoice(admin, reservation.id)
    } else {
      const depositFloor = Math.max(priorPaid, Number(reservation.amount_paid ?? 0))
      const seeded = buildCheckoutInvoicePaymentState({
        invoiceTotal: taxes.total,
        priorDeposit: depositFloor,
        paidNow: false,
      })
      amountPaid = seeded.amountPaid
      paymentStatus = seeded.paymentStatus

      await admin
        .from('invoices')
        .update({
          subtotal: taxes.subtotal,
          ...discountFields,
          ...taxPersist,
          guest_tax_id: guestTaxId,
          total_amount: taxes.total,
          payment_method: input.paymentMethod,
          payment_status: paymentStatus,
          amount_paid: amountPaid,
          paid_at: paymentStatus === 'paid' ? (existing.paid_at ?? now) : null,
        })
        .eq('id', existing.id)
        .eq('hotel_id', reservation.hotel_id)

      if (folioCharges.length) {
        await linkFolioChargesToInvoice(
          admin,
          folioCharges.map((c) => c.id),
          existing.id,
        )
      }

      await linkDepositRecordsToInvoice(admin, reservation.id, existing.id)
      await syncReservationPaymentFromInvoice(admin, reservation.id)
    }

    const invoiceNumber = existing.invoice_number ?? existing.id

    return {
      invoiceId: existing.id,
      invoiceNumber,
      taxes,
      folioSubtotal,
      discountAmount,
      created: false,
      invoicePreview: buildCheckoutInvoicePreview({
        invoiceId: existing.id,
        invoiceNumber,
        ...previewBase,
        paymentStatus,
      }),
      paymentStatus,
      amountPaid,
    }
  }

  const priorDeposit = Number(reservation.amount_paid ?? 0)
  const checkoutPayment = buildCheckoutInvoicePaymentState({
    invoiceTotal: taxes.total,
    priorDeposit,
    paidNow,
  })
  const invoiceNumber = await allocateInvoiceNumber(reservation.hotel_id)
  const dueAt = paidNow
    ? now
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invoiceRow, error } = await admin
    .from('invoices')
    .insert({
      hotel_id: reservation.hotel_id,
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      guest_name: reservation.guest_name,
      invoice_number: invoiceNumber,
      subtotal: taxes.subtotal,
      ...discountFields,
      ...taxPersist,
      guest_tax_id: guestTaxId,
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

  if (error || !invoiceRow) {
    throw new Error(error?.message ?? 'Could not create invoice.')
  }

  if (folioCharges.length) {
    await linkFolioChargesToInvoice(
      admin,
      folioCharges.map((c) => c.id),
      invoiceRow.id,
    )
  }

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

  return {
    invoiceId: invoiceRow.id,
    invoiceNumber,
    taxes,
    folioSubtotal,
    discountAmount,
    created: true,
    invoicePreview: buildCheckoutInvoicePreview({
      invoiceId: invoiceRow.id,
      invoiceNumber,
      ...previewBase,
      paymentStatus: checkoutPayment.paymentStatus,
    }),
    paymentStatus: checkoutPayment.paymentStatus,
    amountPaid: checkoutPayment.amountPaid,
  }
}

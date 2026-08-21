import type { createAdminClient } from '@/lib/supabase/admin'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import { getHotelTaxConfig } from '@/lib/data/settings'
import {
  computeInvoiceTaxes,
  invoiceHasTaxBreakdown,
  noTaxInvoice,
  resolveInvoiceTaxRates,
  type HotelTaxRates,
  type InvoiceTaxes,
  type VatBase,
  type VatMode,
} from '@/lib/tax'
import { calculateStayTotal, roundMoney, type RateType } from '@/lib/pricing/stay-totals'
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
  finalizeReservationCheckoutPayment,
  linkDepositRecordsToInvoice,
  stayInvoiceCollectedAmount,
  syncReservationPaymentFromInvoice,
} from '@/lib/billing/reservation-payment'
import { resolveCollectedAmount } from '@/lib/billing/invoice-ledger'
import { invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import { resolveBillToName } from '@/lib/billing/bill-to'
import {
  stayBillingPeriods,
  splitAmountByWeights,
  waterfallAllocate,
} from '@/lib/billing/stay-periods'
import type { InvoiceExportRow } from '@/lib/export/types'
import type { PaymentMethod, PaymentStatus } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

/** Keep GRA tax on when refreshing an invoice that already has tax lines / Tax ID. */
export function resolveStayInvoiceIncludeTax(
  requestedIncludeTax: boolean | undefined,
  existing: {
    guest_tax_id?: string | null
    nhil_amount?: number | null
    getfund_amount?: number | null
    covid_levy_amount?: number | null
    vat_amount?: number | null
    elevy_amount?: number | null
    tourism_levy_amount?: number | null
  } | null | undefined,
): boolean {
  const existingTaxed = Boolean(
    existing &&
      (existing.guest_tax_id ||
        invoiceHasTaxBreakdown({
          nhil_amount: existing.nhil_amount,
          getfund_amount: existing.getfund_amount,
          covid_levy_amount: existing.covid_levy_amount,
          vat_amount: existing.vat_amount,
          elevy_amount: existing.elevy_amount,
          tourism_levy_amount: existing.tourism_levy_amount,
        })),
  )
  return existingTaxed || requestedIncludeTax === true
}

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
  periodStart: string,
  periodEnd: string,
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
      periodStart,
      periodEnd,
      nightlyRate,
      monthlyRate,
      weeklyRate,
    )
  }

  return Math.max(0, Number(reservation.total_amount ?? 0))
}

async function loadRoomCategoryName(
  admin: AdminClient,
  roomId: string | null | undefined,
): Promise<string | null> {
  if (!roomId) return null
  const { data } = await admin
    .from('rooms')
    .select('room_categories(name)')
    .eq('id', roomId)
    .maybeSingle()
  const cat = data?.room_categories as { name?: string } | { name?: string }[] | null
  const name = Array.isArray(cat) ? cat[0]?.name : cat?.name
  return name?.trim() || null
}

async function computeRoomTaxesForStay(
  admin: AdminClient,
  reservation: StayInvoiceReservation,
  periodStart: string,
  periodEnd: string,
  includeTax: boolean,
  vatMode: VatMode,
  rates: HotelTaxRates,
  vatBase: VatBase,
  periodDiscountAmount?: number,
): Promise<{
  taxes: InvoiceTaxes
  discountAmount: number
  roomListBase: number
}> {
  const roomListBase = await computeRoomChargeAmount(admin, reservation, periodStart, periodEnd)
  const discountType = normalizeDiscountType(reservation.discount_type) as DiscountType
  const { taxableBase, discountAmount: computedDiscount } = applyDiscountToBase(
    roomListBase,
    discountType,
    reservation.discount_value,
  )
  const discountAmount =
    periodDiscountAmount != null ? Math.min(roomListBase, periodDiscountAmount) : computedDiscount
  const taxable =
    periodDiscountAmount != null ? Math.max(0, roomListBase - discountAmount) : taxableBase

  const taxes = !includeTax
    ? noTaxInvoice(taxable)
    : computeInvoiceTaxes(taxable, vatMode, rates, vatBase)

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

type ExistingStayInvoice = {
  id: string
  invoice_number: string | null
  amount_paid: number | null
  payment_status: string | null
  paid_at: string | null
  guest_tax_id: string | null
  tax_snapshot: unknown
  nhil_amount: number | null
  getfund_amount: number | null
  covid_levy_amount: number | null
  vat_amount: number | null
  elevy_amount: number | null
  tourism_levy_amount: number | null
  bill_to_name: string | null
  room_category_name: string | null
  billing_period_start: string | null
  billing_period_end: string | null
}

export type StayInvoiceIssueResult = {
  invoiceId: string
  invoiceNumber: string
  taxes: InvoiceTaxes
  folioSubtotal: number
  discountAmount: number
  created: boolean
  invoicePreview: InvoiceExportRow
  paymentStatus: PaymentStatus
  amountPaid: number
  stayTotals: { total: number; paid: number; balance: number; periodCount: number }
}

/**
 * Create or refresh stay invoices. Monthly rates longer than 30 nights get one
 * unique invoice per rental month. Stay rollup lives on the reservation, not the document.
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
    billToSameAsGuest?: boolean
    billToName?: string | null
    preserveOverpayment?: boolean
  },
): Promise<StayInvoiceIssueResult> {
  const effectiveCheckOut = input.effectiveCheckOut ?? input.reservation.check_out
  const reservation = input.reservation
  const now = new Date().toISOString()
  const paidNow = input.markAsPaid
  const preserveOverpayment = input.preserveOverpayment ?? !paidNow
  const periods = stayBillingPeriods(
    reservation.check_in,
    effectiveCheckOut,
    reservation.rate_type,
  )

  const { data: existingRows } = await admin
    .from('invoices')
    .select(
      'id, invoice_number, amount_paid, payment_status, paid_at, guest_tax_id, tax_snapshot, nhil_amount, getfund_amount, covid_levy_amount, vat_amount, elevy_amount, tourism_levy_amount, bill_to_name, room_category_name, billing_period_start, billing_period_end',
    )
    .eq('reservation_id', reservation.id)
    .eq('hotel_id', reservation.hotel_id)
    .order('billing_period_start', { ascending: true })

  const existingList = (existingRows ?? []) as ExistingStayInvoice[]
  const existing = existingList[0] ?? null

  // New invoices: tax only when requested. Existing taxed invoices keep tax on refresh
  // so check-in/collect/deposit sync cannot wipe GRA lines after money was taken.
  const includeTax = resolveStayInvoiceIncludeTax(input.includeTax, existing)

  const { vatMode, rates: hotelRates } = await getHotelTaxConfig(reservation.hotel_id)
  // Freeze rates after first issue so owner rate edits do not rewrite in-flight invoices.
  const { rates, snapshot: taxSnapshot, vatBase } = resolveInvoiceTaxRates(
    existing?.tax_snapshot,
    hotelRates,
  )

  const billTo = resolveBillToName({
    guestName: reservation.guest_name,
    existing: existing?.bill_to_name ?? null,
    billToSameAsGuest: input.billToSameAsGuest,
    billToName: input.billToName,
  })
  if (!billTo.ok) {
    throw new Error(billTo.error)
  }

  const roomCategoryName =
    (await loadRoomCategoryName(admin, reservation.room_id)) ??
    existing?.room_category_name ??
    null

  const periodRoom = await Promise.all(
    periods.map((period) =>
      computeRoomTaxesForStay(
        admin,
        reservation,
        period.start,
        period.end,
        includeTax,
        vatMode,
        rates,
        vatBase,
      ),
    ),
  )

  const stayDiscount = roundMoney(periodRoom.reduce((sum, p) => sum + p.discountAmount, 0))
  const discountShares = splitAmountByWeights(
    stayDiscount,
    periodRoom.map((p) => p.roomListBase),
  )

  if (Math.abs(Number(reservation.discount_amount ?? 0) - stayDiscount) > 0.009) {
    await admin
      .from('reservations')
      .update({ discount_amount: stayDiscount })
      .eq('id', reservation.id)
      .eq('hotel_id', reservation.hotel_id)
  }

  const partyPersist = {
    bill_to_name: billTo.value,
    room_category_name: roomCategoryName,
  }
  const guestTaxId = resolveInvoiceTaxId(includeTax)

  type PeriodBuild = {
    period: (typeof periods)[number]
    taxes: InvoiceTaxes
    discountAmount: number
    folioCharges: Array<{ id: string }>
    folioSubtotal: number
    existing: ExistingStayInvoice | null
  }

  const built: PeriodBuild[] = []
  let stayFolioSubtotal = 0

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!
    let roomTaxes = periodRoom[i]!.taxes
    let discountAmount = discountShares[i] ?? periodRoom[i]!.discountAmount
    if (Math.abs(discountAmount - periodRoom[i]!.discountAmount) > 0.009) {
      const recomputed = await computeRoomTaxesForStay(
        admin,
        reservation,
        period.start,
        period.end,
        includeTax,
        vatMode,
        rates,
        vatBase,
        discountAmount,
      )
      roomTaxes = recomputed.taxes
      discountAmount = recomputed.discountAmount
    }

    const isLast = i === periods.length - 1
    const withFolio =
      isLast && reservation.guest_id
        ? await prepareCheckoutTaxesWithFolio(
            admin,
            reservation.hotel_id,
            reservation.guest_id,
            reservation.id,
            roomTaxes,
            includeTax,
            rates,
            vatBase,
          )
        : {
            taxes: roomTaxes,
            folioCharges: [] as Array<{ id: string }>,
            folioSubtotal: 0,
          }

    stayFolioSubtotal = roundMoney(stayFolioSubtotal + withFolio.folioSubtotal)

    const matched =
      existingList.find((row) => row.billing_period_start === period.start) ??
      (periods.length > 1 &&
      period.index === 1 &&
      existingList.length === 1 &&
      (!existingList[0]!.billing_period_start ||
        existingList[0]!.billing_period_start === reservation.check_in)
        ? existingList[0]!
        : null)

    built.push({
      period,
      taxes: withFolio.taxes,
      discountAmount,
      folioCharges: withFolio.folioCharges,
      folioSubtotal: withFolio.folioSubtotal,
      existing: matched,
    })
  }

  const periodTotals = built.map((row) => row.taxes.total)
  const alreadySplit = built.every((row) => row.existing && row.existing.billing_period_start === row.period.start)
  let paidByPeriod: number[]
  if (paidNow) {
    paidByPeriod = periodTotals
  } else if (alreadySplit) {
    paidByPeriod = await Promise.all(
      built.map(async (row) =>
        resolveCollectedAmount(admin, {
          invoiceId: row.existing!.id,
          invoiceAmountPaid: row.existing!.amount_paid,
        }),
      ),
    )
  } else {
    const source =
      existingList.length > 0
        ? existingList.reduce((sum, row) => sum + Number(row.amount_paid ?? 0), 0)
        : Number(reservation.amount_paid ?? 0)
    paidByPeriod = waterfallAllocate(periodTotals, source)
  }

  const dueAt = paidNow
    ? now
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const issued: Array<{
    id: string
    invoiceNumber: string
    taxes: InvoiceTaxes
    amountPaid: number
    paymentStatus: PaymentStatus
    created: boolean
    discountAmount: number
    period: (typeof periods)[number]
  }> = []

  for (let i = 0; i < built.length; i++) {
    const row = built[i]!
    const discountFields = invoiceDiscountFields(row.discountAmount, reservation.discount_reason)
    const taxPersist = {
      nhil_amount: row.taxes.nhil,
      getfund_amount: row.taxes.getfund,
      covid_levy_amount: row.taxes.covid,
      vat_amount: row.taxes.vat,
      elevy_amount: row.taxes.elevy,
      tourism_levy_amount: row.taxes.tourism,
      tax_snapshot: taxSnapshot,
    }
    const seeded = stayInvoiceCollectedAmount({
      invoiceTotal: row.taxes.total,
      priorDeposit: paidByPeriod[i] ?? 0,
      paidNow,
      preserveOverpayment,
    })
    const amountPaid = seeded.amountPaid
    const paymentStatus = seeded.paymentStatus

    if (row.existing) {
      const priorPaid = paidByPeriod[i] ?? Number(row.existing.amount_paid ?? 0)
      const balance = paidNow ? invoiceBalanceDue(row.taxes.total, priorPaid) : 0

      await admin
        .from('invoices')
        .update({
          subtotal: row.taxes.subtotal,
          ...discountFields,
          ...taxPersist,
          ...partyPersist,
          guest_tax_id: guestTaxId,
          total_amount: row.taxes.total,
          payment_method: input.paymentMethod,
          payment_status: paymentStatus,
          amount_paid: amountPaid,
          billing_period_start: row.period.start,
          billing_period_end: row.period.end,
          due_at: paidNow ? now : undefined,
          paid_at: paymentStatus === 'paid' ? (row.existing.paid_at ?? now) : null,
        })
        .eq('id', row.existing.id)
        .eq('hotel_id', reservation.hotel_id)

      if (row.folioCharges.length) {
        await linkFolioChargesToInvoice(
          admin,
          row.folioCharges.map((c) => c.id),
          row.existing.id,
        )
      }

      if (periods.length === 1) {
        await linkDepositRecordsToInvoice(admin, reservation.id, row.existing.id)
      }

      if (paidNow && balance > 0.009) {
        await admin.from('payment_records').insert({
          hotel_id: reservation.hotel_id,
          invoice_id: row.existing.id,
          reservation_id: reservation.id,
          guest_id: reservation.guest_id,
          provider: 'manual',
          amount: balance,
          currency: 'GHS',
          status: 'success',
          idempotency_key: `stay-invoice-balance:${row.existing.id}:${now}`,
          completed_at: now,
          metadata: { source: 'stay_invoice_balance' },
        })
      }

      issued.push({
        id: row.existing.id,
        invoiceNumber: row.existing.invoice_number ?? row.existing.id,
        taxes: row.taxes,
        amountPaid,
        paymentStatus,
        created: false,
        discountAmount: row.discountAmount,
        period: row.period,
      })
      continue
    }

    const invoiceNumber = await allocateInvoiceNumber(reservation.hotel_id)
    const { data: invoiceRow, error } = await admin
      .from('invoices')
      .insert({
        hotel_id: reservation.hotel_id,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        guest_name: reservation.guest_name,
        invoice_number: invoiceNumber,
        subtotal: row.taxes.subtotal,
        ...discountFields,
        ...taxPersist,
        ...partyPersist,
        guest_tax_id: guestTaxId,
        total_amount: row.taxes.total,
        payment_method: input.paymentMethod,
        payment_status: paymentStatus,
        amount_paid: amountPaid,
        billing_period_start: row.period.start,
        billing_period_end: row.period.end,
        issued_at: now,
        due_at: dueAt,
        paid_at: paymentStatus === 'paid' ? now : null,
      })
      .select('id')
      .single()

    if (error || !invoiceRow) {
      throw new Error(error?.message ?? 'Could not create invoice.')
    }

    if (row.folioCharges.length) {
      await linkFolioChargesToInvoice(
        admin,
        row.folioCharges.map((c) => c.id),
        invoiceRow.id,
      )
    }

    if (periods.length === 1) {
      await finalizeReservationCheckoutPayment(admin, {
        reservationId: reservation.id,
        invoiceId: invoiceRow.id,
        hotelId: reservation.hotel_id,
        guestId: reservation.guest_id,
        invoiceTotal: row.taxes.total,
        priorDeposit: paidByPeriod[i] ?? Number(reservation.amount_paid ?? 0),
        paidNow,
        paymentMethod: input.paymentMethod,
        now,
      })
    }

    issued.push({
      id: invoiceRow.id,
      invoiceNumber,
      taxes: row.taxes,
      amountPaid,
      paymentStatus,
      created: true,
      discountAmount: row.discountAmount,
      period: row.period,
    })
  }

  await syncReservationPaymentFromInvoice(admin, reservation.id)

  const stayTotal = roundMoney(issued.reduce((sum, row) => sum + row.taxes.total, 0))
  const stayPaid = roundMoney(issued.reduce((sum, row) => sum + row.amountPaid, 0))
  const open =
    issued.find((row) => invoiceBalanceDue(row.taxes.total, row.amountPaid) > 0.009) ??
    issued[issued.length - 1]!

  return {
    invoiceId: open.id,
    invoiceNumber: open.invoiceNumber,
    taxes: open.taxes,
    folioSubtotal: stayFolioSubtotal,
    discountAmount: open.discountAmount,
    created: issued.some((row) => row.created),
    invoicePreview: buildCheckoutInvoicePreview({
      invoiceId: open.id,
      invoiceNumber: open.invoiceNumber,
      guestName: reservation.guest_name,
      billToName: billTo.value,
      guestPhone: input.guestPhone ?? null,
      guestTaxId,
      roomNumber: input.roomNumber ?? null,
      roomCategoryName,
      checkIn: open.period.start,
      checkOut: open.period.end,
      issuedAt: now,
      subtotal: open.taxes.subtotal,
      discountAmount: open.discountAmount,
      discountReason: invoiceDiscountFields(open.discountAmount, reservation.discount_reason)
        .discount_reason,
      nhil: open.taxes.nhil,
      getfund: open.taxes.getfund,
      covid: open.taxes.covid,
      vat: open.taxes.vat,
      elevy: open.taxes.elevy,
      tourism: open.taxes.tourism,
      taxSnapshot,
      total: open.taxes.total,
      paymentMethod: input.paymentMethod,
      paymentStatus: open.paymentStatus,
      amountPaid: open.amountPaid,
    }),
    paymentStatus: open.paymentStatus,
    amountPaid: open.amountPaid,
    stayTotals: {
      total: stayTotal,
      paid: stayPaid,
      balance: invoiceBalanceDue(stayTotal, stayPaid),
      periodCount: issued.length,
    },
  }
}

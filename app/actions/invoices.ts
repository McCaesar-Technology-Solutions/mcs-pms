'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import { computeInvoiceTaxesWithOption } from '@/lib/tax'
import { getHotelVatMode } from '@/lib/data/settings'
import {
  invoiceBalanceDue,
} from '@/lib/billing/invoice-payments'
import { applyInvoicePaymentRecord } from '@/lib/billing/apply-payment'
import { syncReservationPaymentFromInvoice } from '@/lib/billing/reservation-payment'
import { writeAuditLog } from '@/lib/audit/log'
import type { PaymentMethod } from '@/types'

export type InvoiceActionResult = { success: true } | { success: false; error: string }

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

async function requireBillingStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id, name')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || profile.role !== 'owner') return null
  return profile
}

function revalidateBilling() {
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
  revalidatePath('/owner/dashboard')
  revalidatePath('/owner/reservations')
  revalidatePath('/manager/reservations')
  revalidatePath('/receptionist/reservations')
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
  const profile = await requireBillingStaff()
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

  const profile = await requireBillingStaff()
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

  const profile = await requireBillingStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

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

  const now = new Date().toISOString()
  const idempotencyKey = `refund:${parsed.data.invoiceId}:${randomUUID()}`

  await admin.from('payment_records').insert({
    hotel_id: profile.hotel_id,
    invoice_id: parsed.data.invoiceId,
    guest_id: invoice.guest_id,
    provider: 'manual',
    provider_reference: parsed.data.reason ?? 'Refund',
    amount: -refundAmount,
    currency: 'GHS',
    status: 'refunded',
    idempotency_key: idempotencyKey,
    completed_at: now,
    metadata: parsed.data.reason ? { reason: parsed.data.reason } : null,
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
    details: { reason: parsed.data.reason },
  })

  revalidateBilling()
  return { success: true }
}

export async function createManualInvoice(
  input: z.infer<typeof createManualInvoiceSchema>,
): Promise<InvoiceActionResult> {
  const parsed = createManualInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const profile = await requireBillingStaff()
  if (!profile?.hotel_id) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const vatMode = await getHotelVatMode(profile.hotel_id)
  const taxes = computeInvoiceTaxesWithOption(parsed.data.subtotal, vatMode, parsed.data.includeTax)
  const now = new Date().toISOString()
  const paidNow = parsed.data.markAsPaid
  const invoiceNumber = await allocateInvoiceNumber(profile.hotel_id)

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

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allocateInvoiceNumber } from '@/lib/invoices/numbering'
import { computeInvoiceTaxes } from '@/lib/tax'
import { getHotelVatMode } from '@/lib/data/settings'
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
})

async function requireBillingStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.hotel_id || profile.role !== 'owner') return null
  return profile
}

function revalidateBilling() {
  revalidatePath('/owner/billing')
  revalidatePath('/owner/gra-reports')
  revalidatePath('/owner/dashboard')
}

function dueDateISO(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
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
    .select('id, payment_status')
    .eq('id', invoiceId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!invoice) return { success: false, error: 'Invoice not found.' }
  if (invoice.payment_status === 'paid') {
    return { success: false, error: 'Invoice is already paid.' }
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('invoices')
    .update({
      payment_status: 'paid',
      paid_at: now,
      ...(paymentMethod && VALID_PAYMENT_METHODS.includes(paymentMethod)
        ? { payment_method: paymentMethod }
        : {}),
    })
    .eq('id', invoiceId)

  if (error) return { success: false, error: error.message }

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
  const taxes = computeInvoiceTaxes(parsed.data.subtotal, vatMode)
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
    issued_at: now,
    due_at: paidNow ? now : dueDateISO(7),
    paid_at: paidNow ? now : null,
  })

  if (error) return { success: false, error: error.message }

  revalidateBilling()
  return { success: true }
}

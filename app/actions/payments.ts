'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { consumeStaffAuthError } from '@/lib/auth/staff-session'
import { writeAuditLog } from '@/lib/audit/log'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGuestFromSession } from '@/app/actions/guest'
import { guestNeedsRulesAcceptance } from '@/app/actions/guest-rules'
import { isPaymentsEnabled } from '@/lib/payments/enabled'
import {
  initiateInvoiceOnlinePayment,
  initiateReservationDepositOnlinePayment,
} from '@/lib/payments/initiate'
import { assertRateLimit, guestRateKey, GUEST_RATE_LIMITS } from '@/lib/rate-limit'

const initiateSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive().optional(),
})

const initiateDepositSchema = z.object({
  reservationId: z.string().uuid(),
  amount: z.coerce.number().positive(),
})

const markAbandonedSchema = z.object({
  paymentId: z.string().uuid(),
})

export type PaymentActionResult =
  | {
      success: true
      data: { authorizationUrl: string; reference: string; paymentId: string; reused: boolean }
    }
  | { success: false; error: string }

export type PaymentStatusActionResult =
  | { success: true }
  | { success: false; error: string }

async function requireGuestWithRules() {
  const session = await getGuestFromSession()
  if (!session.success) {
    return { ok: false as const, error: session.error ?? 'Not authorized.' }
  }
  if (!session.data) {
    return { ok: false as const, error: 'Not authorized.' }
  }
  if (await guestNeedsRulesAcceptance(session.data.guest.id)) {
    return { ok: false as const, error: 'Please accept the property rules to continue.' }
  }
  return { ok: true as const, guest: session.data.guest, roomNumber: session.data.roomNumber }
}

function paymentsDisabledError(): PaymentActionResult {
  return { success: false, error: 'Online payments are not enabled for this property.' }
}

/**
 * Staff-initiated Paystack checkout for an open invoice (front desk / billing).
 * Amount is always capped to the server-side invoice balance — never trust client prices alone.
 */
export async function initiateStaffPayment(input: unknown): Promise<PaymentActionResult> {
  if (!isPaymentsEnabled()) return paymentsDisabledError()

  const parsed = initiateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payment request.' }
  }

  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: consumeStaffAuthError() }
  }

  const admin = createAdminClient()
  const result = await initiateInvoiceOnlinePayment(admin, {
    hotelId: profile.hotel_id,
    invoiceId: parsed.data.invoiceId,
    amountGhs: parsed.data.amount,
    initiatedBy: profile.id,
    guestPortalInitiated: false,
    callbackPath: '/payments/complete',
  })

  if (!result.ok) return { success: false, error: result.error }

  if (!result.reused) {
    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'payment',
      entityId: result.paymentId,
      action: 'payment_initiated',
      summary: `Started online payment for invoice`,
      details: {
        invoiceId: parsed.data.invoiceId,
        reference: result.reference,
      },
    })
  }

  revalidatePath('/owner/billing')
  revalidatePath('/manager/invoices')
  return {
    success: true,
    data: {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      paymentId: result.paymentId,
      reused: result.reused,
    },
  }
}

/**
 * Staff-initiated Paystack checkout for a pre-checkout reservation deposit.
 * Amount is validated against the reservation balance server-side.
 */
export async function initiateStaffDepositPayment(input: unknown): Promise<PaymentActionResult> {
  if (!isPaymentsEnabled()) return paymentsDisabledError()

  const parsed = initiateDepositSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid deposit request.' }
  }

  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: consumeStaffAuthError() }
  }

  const admin = createAdminClient()
  const result = await initiateReservationDepositOnlinePayment(admin, {
    hotelId: profile.hotel_id,
    reservationId: parsed.data.reservationId,
    amountGhs: parsed.data.amount,
    initiatedBy: profile.id,
    callbackPath: '/payments/complete',
  })

  if (!result.ok) return { success: false, error: result.error }

  if (!result.reused) {
    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'payment',
      entityId: result.paymentId,
      action: 'deposit_initiated',
      summary: `Started online deposit for reservation`,
      details: {
        reservationId: parsed.data.reservationId,
        amount: parsed.data.amount,
        reference: result.reference,
      },
    })
  }

  revalidatePath('/owner/reservations')
  revalidatePath('/manager/reservations')
  revalidatePath('/receptionist/reservations')
  revalidatePath('/owner/billing')
  return {
    success: true,
    data: {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      paymentId: result.paymentId,
      reused: result.reused,
    },
  }
}

/**
 * Guest-portal-initiated Paystack checkout. Mirrors guest-portal action auth
 * (session cookie + rules acceptance), not staff profiles.
 */
export async function initiateGuestPortalPayment(input: unknown): Promise<PaymentActionResult> {
  if (!isPaymentsEnabled()) return paymentsDisabledError()

  const parsed = initiateSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payment request.' }
  }

  const auth = await requireGuestWithRules()
  if (!auth.ok) return { success: false, error: auth.error }

  const hotelId = auth.guest.hotel_id
  if (!hotelId) return { success: false, error: 'Not authorized.' }

  const rateError = await assertRateLimit(
    guestRateKey('payment', auth.guest.id),
    GUEST_RATE_LIMITS.payment,
    'Too many payment attempts. Please wait a few minutes and try again.',
  )
  if (rateError) return { success: false, error: rateError }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, guest_id')
    .eq('id', parsed.data.invoiceId)
    .eq('hotel_id', hotelId)
    .eq('guest_id', auth.guest.id)
    .maybeSingle()

  if (!invoice) return { success: false, error: 'Invoice not found.' }

  const result = await initiateInvoiceOnlinePayment(admin, {
    hotelId,
    invoiceId: parsed.data.invoiceId,
    amountGhs: parsed.data.amount,
    initiatedBy: null,
    guestPortalInitiated: true,
    callbackPath: '/guest',
  })

  if (!result.ok) return { success: false, error: result.error }

  if (!result.reused) {
    void writeAuditLog({
      hotelId,
      actorId: null,
      actorName: auth.guest.name ?? 'Guest',
      entityType: 'payment',
      entityId: result.paymentId,
      action: 'payment_initiated_guest',
      summary: `Guest started online payment`,
      details: {
        invoiceId: parsed.data.invoiceId,
        reference: result.reference,
        guestId: auth.guest.id,
      },
    })
  }

  return {
    success: true,
    data: {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      paymentId: result.paymentId,
      reused: result.reused,
    },
  }
}

const PENDING_ABANDON_MIN_MS = 30 * 60 * 1000

/**
 * Staff marks a stuck pending Paystack attempt as abandoned (guest closed tab).
 * Only allowed after 30 minutes — no silent auto-expiry.
 */
export async function markPaymentAbandoned(input: unknown): Promise<PaymentStatusActionResult> {
  if (!isPaymentsEnabled()) {
    return { success: false, error: 'Online payments are not enabled for this property.' }
  }

  const parsed = markAbandonedSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request.' }
  }

  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return { success: false, error: consumeStaffAuthError() }
  }

  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('payments')
    .select('id, status, created_at, provider_reference, amount')
    .eq('id', parsed.data.paymentId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!payment) return { success: false, error: 'Payment not found.' }
  if (payment.status !== 'pending') {
    return { success: false, error: 'Only pending payments can be marked abandoned.' }
  }

  const ageMs = Date.now() - new Date(payment.created_at).getTime()
  if (ageMs < PENDING_ABANDON_MIN_MS) {
    return {
      success: false,
      error: 'Wait at least 30 minutes before marking a pending payment as abandoned.',
    }
  }

  const now = new Date().toISOString()
  const { data: updated } = await admin
    .from('payments')
    .update({ status: 'abandoned', updated_at: now })
    .eq('id', payment.id)
    .eq('hotel_id', profile.hotel_id)
    .eq('status', 'pending')
    .select('id')

  if (!updated?.length) {
    return { success: false, error: 'Payment is no longer pending.' }
  }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'payment',
    entityId: payment.id,
    action: 'payment_abandoned',
    summary: `Marked online payment as abandoned (${payment.provider_reference})`,
    details: { amount: payment.amount, reference: payment.provider_reference },
  })

  revalidatePath('/owner/billing')
  revalidatePath('/manager/invoices')
  return { success: true }
}

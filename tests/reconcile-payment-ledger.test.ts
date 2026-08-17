import { describe, expect, it, vi } from 'vitest'
import { reconcilePaymentLedger } from '@/lib/billing/reconcile-payment-ledger'
import { buildCheckoutInvoicePaymentState } from '@/lib/billing/reservation-payment'

describe('buildCheckoutInvoicePaymentState', () => {
  it('preserves prior deposit when invoice total increases', () => {
    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: 600,
      priorDeposit: 200,
      paidNow: false,
    })
    expect(state.amountPaid).toBe(200)
    expect(state.paymentStatus).toBe('partial')
  })

  it('never drops collected money below prior deposit on refresh', () => {
    const state = buildCheckoutInvoicePaymentState({
      invoiceTotal: 400,
      priorDeposit: 500,
      paidNow: false,
    })
    expect(state.amountPaid).toBe(400)
    expect(state.paymentStatus).toBe('paid')
  })
})

describe('reconcilePaymentLedger', () => {
  it('reports reservation gaps in dry-run mode', async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({
                gt: async () => ({
                  data: [{ id: 'res-1', guest_id: 'g1', amount_paid: 150, payment_method: 'cash' }],
                }),
              }),
            }),
          }
        }
        if (table === 'invoices') {
          return {
            select: () => ({
              eq: () => ({
                gt: async () => ({ data: [] }),
                not: () => ({ data: [] }),
              }),
            }),
          }
        }
        if (table === 'payment_records') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null }),
                  is: () => ({
                    eq: async () => ({ count: 0 }),
                  }),
                }),
                is: () => ({
                  eq: async () => ({ count: 0 }),
                }),
              }),
            }),
            insert: vi.fn(),
            update: vi.fn(),
          }
        }
        return { select: () => ({ eq: () => ({}) }) }
      }),
    }

    const paymentQuery = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    }
    paymentQuery.eq.mockImplementation(function (this: unknown, key: string) {
      if (key === 'status') {
        return {
          eq: async () => ({ data: [{ amount: 50 }] }),
        }
      }
      return paymentQuery
    })

    ;(admin.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'payment_records') {
        return {
          select: () => paymentQuery,
          insert: vi.fn(),
          update: vi.fn(),
        }
      }
      if (table === 'reservations') {
        return {
          select: () => ({
            eq: () => ({
              gt: async () => ({
                data: [{ id: 'res-1', guest_id: 'g1', amount_paid: 150, payment_method: 'cash' }],
              }),
            }),
          }),
        }
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            eq: () => ({
              gt: async () => ({ data: [] }),
              not: () => ({ data: [] }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({}) }) }
    })

    const result = await reconcilePaymentLedger(admin as never, 'hotel-1', { dryRun: true })
    expect(result.reservationBackfills).toBe(1)
    expect(result.reservationGapsGhs).toBe(100)
    expect(result.invoiceBackfills).toBe(0)
  })
})

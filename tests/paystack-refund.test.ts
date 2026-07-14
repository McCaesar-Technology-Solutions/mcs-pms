import { beforeEach, describe, expect, it, vi } from 'vitest'

const refundMock = vi.fn()

vi.mock('@/lib/payments/enabled', () => ({
  isPaymentsEnabled: () => true,
  getPaystackSecretKey: () => 'sk_test',
}))

vi.mock('@/lib/payments/get-provider', () => ({
  getPaymentProvider: () => ({
    refund: (...args: unknown[]) => refundMock(...args),
  }),
}))

import { refundOnlineInvoicePayments } from '@/lib/payments/refund-online'

const HOTEL_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('refundOnlineInvoicePayments', () => {
  beforeEach(() => {
    refundMock.mockReset()
    refundMock.mockResolvedValue({
      refundId: 'rf_1',
      transaction: 'pay_ref_1',
      amountKobo: 5000,
      status: 'processed',
    })
  })

  it('calls Paystack refund and marks full charge refunded', async () => {
    const updates: Array<Record<string, unknown>> = []
    const admin = {
      from: (table: string) => {
        if (table !== 'payments') throw new Error(table)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: async () => ({
                      data: [
                        {
                          id: 'pay-1',
                          amount: 100,
                          provider_reference: 'pay_ref_1',
                          status: 'success',
                          raw_webhook_payload: null,
                        },
                      ],
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            updates.push(payload)
            return {
              eq: () => ({
                eq: async () => ({ data: null, error: null }),
              }),
            }
          },
        }
      },
    }

    const result = await refundOnlineInvoicePayments(admin as never, {
      hotelId: HOTEL_ID,
      invoiceId: INVOICE_ID,
      amountGhs: 50,
      reason: 'Guest early checkout',
    })

    expect(result).toEqual({
      ok: true,
      refundedOnlineGhs: 50,
      references: ['pay_ref_1'],
    })
    expect(refundMock).toHaveBeenCalledWith({
      transaction: 'pay_ref_1',
      amountKobo: 5000,
      reason: 'Guest early checkout',
    })
    expect(updates[0]?.status).toBe('success')
    expect((updates[0]?.raw_webhook_payload as { refunded_total_ghs: number }).refunded_total_ghs).toBe(
      50,
    )
  })

  it('fails closed when Paystack refund errors', async () => {
    refundMock.mockRejectedValue(new Error('Insufficient balance'))
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({
                    data: [
                      {
                        id: 'pay-1',
                        amount: 100,
                        provider_reference: 'pay_ref_1',
                        status: 'success',
                        raw_webhook_payload: null,
                      },
                    ],
                  }),
                }),
              }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: async () => ({ data: null }),
          }),
        }),
      }),
    }

    const result = await refundOnlineInvoicePayments(admin as never, {
      hotelId: HOTEL_ID,
      invoiceId: INVOICE_ID,
      amountGhs: 100,
    })

    expect(result).toEqual({ ok: false, error: 'Insufficient balance' })
  })
})

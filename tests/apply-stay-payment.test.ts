import { describe, expect, it } from 'vitest'
import { applyStayPayment, findStayInvoiceForReservation } from '@/lib/billing/apply-stay-payment'

const HOTEL_ID = '11111111-1111-4111-8111-111111111111'
const RES_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const INV_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

describe('applyStayPayment', () => {
  it('applies pre-invoice deposit on reservation only', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const updates: Array<Record<string, unknown>> = []

    const admin = {
      from: (table: string) => {
        if (table === 'invoices') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: async () => ({ data: [] }),
                  maybeSingle: async () => ({ data: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: RES_ID,
                      guest_id: null,
                      status: 'confirmed',
                      total_amount: 400,
                      amount_paid: 0,
                    },
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updates.push(payload)
              return { eq: async () => ({ error: null }) }
            },
          }
        }
        if (table === 'payment_records') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
            insert: async (payload: Record<string, unknown>) => {
              inserts.push(payload)
              return { error: null }
            },
          }
        }
        throw new Error(table)
      },
    }

    const result = await applyStayPayment(admin as never, {
      hotelId: HOTEL_ID,
      reservationId: RES_ID,
      amount: 100,
      paymentMethod: 'cash',
      provider: 'manual',
      idempotencyKey: 'test:deposit:1',
      metadata: { type: 'deposit' },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.amountApplied).toBe(100)
    expect(result.balanceDue).toBe(300)
    expect(result.invoiceId).toBeNull()
    expect(result.paymentStatus).toBe('deposit_paid')
    expect(inserts[0]).toMatchObject({ amount: 100, reservation_id: RES_ID })
    expect(updates[0]).toMatchObject({ amount_paid: 100, payment_status: 'deposit_paid' })
  })

  it('applies payment to stay invoice and syncs reservation as partial', async () => {
    const invoiceUpdates: Array<Record<string, unknown>> = []
    const reservationUpdates: Array<Record<string, unknown>> = []
    const invoiceState = {
      id: INV_ID,
      reservation_id: RES_ID,
      guest_id: null,
      total_amount: 600,
      amount_paid: 200,
      payment_status: 'partial',
      payment_method: 'cash',
    }

    const admin = {
      from: (table: string) => {
        if (table === 'invoices') {
          return {
            select: () => ({
              eq: (col: string) => {
                if (col === 'reservation_id') {
                  return Promise.resolve({ data: [{ ...invoiceState }] })
                }
                return {
                  eq: () => ({
                    maybeSingle: async () => ({ data: { ...invoiceState } }),
                    order: async () => ({ data: [{ ...invoiceState }] }),
                  }),
                  maybeSingle: async () => ({ data: { ...invoiceState } }),
                }
              },
            }),
            update: (payload: Record<string, unknown>) => {
              Object.assign(invoiceState, payload)
              invoiceUpdates.push(payload)
              return { eq: async () => ({ error: null }) }
            },
          }
        }
        if (table === 'reservations') {
          return {
            update: (payload: Record<string, unknown>) => {
              reservationUpdates.push(payload)
              return { eq: async () => ({ error: null }) }
            },
          }
        }
        if (table === 'payment_records') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
            insert: async () => ({ error: null }),
          }
        }
        throw new Error(table)
      },
    }

    const result = await applyStayPayment(admin as never, {
      hotelId: HOTEL_ID,
      invoiceId: INV_ID,
      amount: 150,
      paymentMethod: 'mtn_momo',
      provider: 'manual',
      idempotencyKey: 'test:partial:1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.amountApplied).toBe(150)
    expect(result.balanceDue).toBe(250)
    expect(result.invoiceId).toBe(INV_ID)
    expect(result.paymentStatus).toBe('partial')
    expect(invoiceUpdates[0]).toMatchObject({ amount_paid: 350, payment_status: 'partial' })
    expect(reservationUpdates[0]).toMatchObject({
      amount_paid: 350,
      payment_status: 'partial',
    })
  })

  it('findStayInvoiceForReservation returns linked invoice', async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: INV_ID,
                    reservation_id: RES_ID,
                    total_amount: 100,
                    amount_paid: 0,
                    payment_status: 'pending',
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    }

    const invoice = await findStayInvoiceForReservation(admin as never, HOTEL_ID, RES_ID)
    expect(invoice?.id).toBe(INV_ID)
  })

  it('findStayInvoiceForReservation returns the oldest open invoice', async () => {
    const paid = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      reservation_id: RES_ID,
      total_amount: 300,
      amount_paid: 300,
      payment_status: 'paid',
    }
    const open = {
      id: INV_ID,
      reservation_id: RES_ID,
      total_amount: 200,
      amount_paid: 0,
      payment_status: 'pending',
    }
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: [paid, open] }),
            }),
          }),
        }),
      }),
    }

    const invoice = await findStayInvoiceForReservation(admin as never, HOTEL_ID, RES_ID)
    expect(invoice?.id).toBe(INV_ID)
  })

  it('findStayInvoiceForReservation skips zeroed dropped extension invoices', async () => {
    const dropped = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      reservation_id: RES_ID,
      total_amount: 0,
      amount_paid: 50,
      payment_status: 'paid',
    }
    const stay = {
      id: INV_ID,
      reservation_id: RES_ID,
      total_amount: 300,
      amount_paid: 300,
      payment_status: 'paid',
    }
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: async () => ({ data: [stay, dropped] }),
            }),
          }),
        }),
      }),
    }

    const invoice = await findStayInvoiceForReservation(admin as never, HOTEL_ID, RES_ID)
    expect(invoice?.id).toBe(INV_ID)
  })
})

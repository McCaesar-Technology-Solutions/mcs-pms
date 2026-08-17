import { beforeEach, describe, expect, it, vi } from 'vitest'

const transitionReservation = vi.fn()

vi.mock('@/lib/reservations/state-machine', () => ({
  transitionReservation: (...args: unknown[]) => transitionReservation(...args),
}))

import { applyOnlineReservationDeposit } from '@/lib/payments/apply-deposit'

const HOTEL_ID = '11111111-1111-4111-8111-111111111111'
const RES_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function invoiceLookupNull() {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
  }
}

describe('applyOnlineReservationDeposit', () => {
  beforeEach(() => {
    transitionReservation.mockReset()
    transitionReservation.mockResolvedValue({ success: true })
  })

  it('records payment_records and updates reservation amount_paid', async () => {
    const inserts: Array<Record<string, unknown>> = []
    const updates: Array<Record<string, unknown>> = []

    const admin = {
      from: (table: string) => {
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: RES_ID,
                      hotel_id: HOTEL_ID,
                      guest_id: null,
                      guest_name: 'Kojo',
                      status: 'confirmed',
                      total_amount: 500,
                      amount_paid: 0,
                    },
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              updates.push(payload)
              return {
                eq: async () => ({ error: null }),
              }
            },
          }
        }
        if (table === 'invoices') return invoiceLookupNull()
        if (table === 'payment_records') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
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

    const result = await applyOnlineReservationDeposit(admin as never, {
      hotelId: HOTEL_ID,
      reservationId: RES_ID,
      amount: 200,
      paymentMethod: 'mtn_momo',
      providerReference: 'dep_ref_1',
    })

    expect(result).toEqual({ ok: true })
    expect(inserts[0]).toMatchObject({
      provider: 'paystack',
      amount: 200,
      reservation_id: RES_ID,
      status: 'success',
    })
    expect(updates[0]).toMatchObject({
      amount_paid: 200,
      payment_status: 'deposit_paid',
    })
    expect(transitionReservation).not.toHaveBeenCalled()
  })

  it('confirms provisional reservations after deposit', async () => {
    const admin = {
      from: (table: string) => {
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: RES_ID,
                      hotel_id: HOTEL_ID,
                      guest_id: null,
                      guest_name: 'Ama',
                      status: 'provisional',
                      total_amount: 400,
                      amount_paid: 0,
                    },
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          }
        }
        if (table === 'invoices') return invoiceLookupNull()
        if (table === 'payment_records') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
            insert: async () => ({ error: null }),
          }
        }
        throw new Error(table)
      },
    }

    const result = await applyOnlineReservationDeposit(admin as never, {
      hotelId: HOTEL_ID,
      reservationId: RES_ID,
      amount: 100,
      paymentMethod: 'visa',
      providerReference: 'dep_ref_2',
      actorId: 'staff-1',
    })

    expect(result).toEqual({ ok: true })
    expect(transitionReservation).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: RES_ID,
        toStatus: 'confirmed',
        actorRole: 'system',
      }),
    )
  })

  it('routes deposit through stay invoice when one exists', async () => {
    const invoiceUpdates: Array<Record<string, unknown>> = []
    const reservationUpdates: Array<Record<string, unknown>> = []
    const invoiceState = {
      id: 'inv-1',
      reservation_id: RES_ID,
      guest_id: null,
      total_amount: 500,
      amount_paid: 0,
      payment_status: 'pending',
      payment_method: 'cash',
    }

    const admin = {
      from: (table: string) => {
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: RES_ID,
                      hotel_id: HOTEL_ID,
                      guest_id: null,
                      status: 'checked_in',
                      total_amount: 500,
                      amount_paid: 0,
                    },
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              reservationUpdates.push(payload)
              return { eq: async () => ({ error: null }) }
            },
          }
        }
        if (table === 'invoices') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: { ...invoiceState } }),
                }),
                maybeSingle: async () => ({ data: { ...invoiceState } }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              Object.assign(invoiceState, payload)
              invoiceUpdates.push(payload)
              return { eq: async () => ({ error: null }) }
            },
          }
        }
        if (table === 'payment_records') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
            insert: async () => ({ error: null }),
          }
        }
        throw new Error(table)
      },
    }

    const result = await applyOnlineReservationDeposit(admin as never, {
      hotelId: HOTEL_ID,
      reservationId: RES_ID,
      amount: 150,
      paymentMethod: 'cash',
      providerReference: 'dep_ref_3',
    })

    expect(result).toEqual({ ok: true })
    expect(invoiceUpdates[0]).toMatchObject({
      amount_paid: 150,
      payment_status: 'partial',
    })
    expect(reservationUpdates[0]).toMatchObject({
      amount_paid: 150,
      payment_status: 'partial',
    })
  })
})

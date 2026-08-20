import { describe, expect, it } from 'vitest'
import { mergeRoomTaxesWithFolio } from '@/lib/folio/rollup'
import {
  calculateNoShowChargeAmount,
  calculateOverstayChargeAmount,
  folioChargesWithoutOverstayFee,
  hasActiveOverstayCharge,
  isOverstayFeeCharge,
  OVERSTAY_CHARGE_EVENT,
  OVERSTAY_CHARGE_REVERSED_EVENT,
  OVERSTAY_FEE_DESCRIPTION,
  reverseOverstayChargeOnExtend,
} from '@/lib/reservations/lifecycle-charges'
import { noTaxInvoice } from '@/lib/tax'

const baseReservation = {
  id: 'r1',
  hotel_id: 'h1',
  guest_id: 'g1',
  check_in: '2026-06-01',
  check_out: '2026-06-04',
  room_id: 'room1',
  nightly_rate: 200,
  weekly_rate: 1400,
  monthly_rate: 4500,
  rate_type: 'nightly' as const,
  total_amount: 600,
  amount_paid: 0,
}

function thenable(data: unknown) {
  const api: Record<string, unknown> = {}
  const self = () => api
  for (const method of ['select', 'eq', 'in', 'is', 'order', 'limit', 'delete']) {
    api[method] = self
  }
  api.then = (resolve: (value: { data: unknown }) => unknown) =>
    Promise.resolve({ data }).then(resolve)
  return api
}

describe('lifecycle charges', () => {
  it('calculates no-show one night', () => {
    expect(
      calculateNoShowChargeAmount(baseReservation, 'one_night', 200, 4500, 1400),
    ).toBe(200)
  })

  it('calculates no-show one night for weekly rate', () => {
    expect(
      calculateNoShowChargeAmount(
        { ...baseReservation, rate_type: 'weekly' },
        'one_night',
        200,
        4500,
        1400,
      ),
    ).toBe(200)
  })

  it('calculates no-show full stay from booked total', () => {
    expect(
      calculateNoShowChargeAmount(baseReservation, 'full_stay', 200, 4500, 1400),
    ).toBe(600)
  })

  it('returns zero for no-show none policy', () => {
    expect(
      calculateNoShowChargeAmount(baseReservation, 'none', 200, 4500, 1400),
    ).toBe(0)
  })

  it('calculates overstay as one extra night', () => {
    expect(
      calculateOverstayChargeAmount(baseReservation, 200, 4500, 1400),
    ).toBe(200)
  })
})

describe('overstay fee on stay extension', () => {
  it('identifies the cron overstay folio line', () => {
    expect(isOverstayFeeCharge({ description: OVERSTAY_FEE_DESCRIPTION })).toBe(true)
    expect(isOverstayFeeCharge({ description: 'Minibar' })).toBe(false)
  })

  it('drops the overstay night from folio so extended room nights are not billed twice', () => {
    const charges = [
      { id: '1', amount: 200, description: OVERSTAY_FEE_DESCRIPTION, charge_type: 'room' },
      { id: '2', amount: 40, description: 'Minibar', charge_type: 'incidental' },
    ]
    const kept = folioChargesWithoutOverstayFee(charges)
    expect(kept).toEqual([charges[1]])

    const roomTaxes = noTaxInvoice(800)
    const withFee = mergeRoomTaxesWithFolio(roomTaxes, 240)
    const afterReverse = mergeRoomTaxesWithFolio(
      roomTaxes,
      kept.reduce((sum, row) => sum + row.amount, 0),
    )
    expect(withFee.total).toBe(1040)
    expect(afterReverse.total).toBe(840)
  })

  it('treats a reversed overstay event as inactive so a later overstay can post again', async () => {
    const admin = {
      from: () => thenable([{ event_type: OVERSTAY_CHARGE_REVERSED_EVENT }]),
    }
    await expect(hasActiveOverstayCharge(admin as never, 'r1')).resolves.toBe(false)
  })

  it('treats the latest posted overstay event as active', async () => {
    const admin = {
      from: () => thenable([{ event_type: OVERSTAY_CHARGE_EVENT }]),
    }
    await expect(hasActiveOverstayCharge(admin as never, 'r1')).resolves.toBe(true)
  })

  it('deletes the unbilled overstay fee and records a reversal', async () => {
    const deletedIds: string[][] = []
    const inserted: Array<Record<string, unknown>> = []

    const admin = {
      from: (table: string) => {
        if (table === 'guest_charges') {
          return {
            select: () => thenable([
              { id: 'chg-1', amount: 200, description: OVERSTAY_FEE_DESCRIPTION },
            ]),
            delete: () => ({
              in: async (_col: string, ids: string[]) => {
                deletedIds.push(ids)
                return { error: null }
              },
            }),
          }
        }
        if (table === 'reservation_events') {
          return {
            select: () => thenable([{ event_type: OVERSTAY_CHARGE_EVENT }]),
            insert: async (payload: Record<string, unknown>) => {
              inserted.push(payload)
              return { error: null }
            },
          }
        }
        throw new Error(table)
      },
    }

    const result = await reverseOverstayChargeOnExtend(admin as never, {
      hotelId: 'h1',
      reservationId: 'r1',
      guestId: 'g1',
      actorId: 'staff-1',
    })

    expect(result).toEqual({ reversed: true, amount: 200 })
    expect(deletedIds).toEqual([['chg-1']])
    expect(inserted[0]).toMatchObject({
      reservation_id: 'r1',
      event_type: OVERSTAY_CHARGE_REVERSED_EVENT,
      payload: { amount: 200, source: 'stay_extended' },
    })
  })

  it('no-ops when there is no overstay fee to reverse', async () => {
    const admin = {
      from: (table: string) => {
        if (table === 'guest_charges') {
          return {
            select: () => thenable([]),
            delete: () => ({
              in: async () => {
                throw new Error('should not delete')
              },
            }),
          }
        }
        if (table === 'reservation_events') {
          return {
            select: () => thenable([]),
            insert: async () => {
              throw new Error('should not insert')
            },
          }
        }
        throw new Error(table)
      },
    }

    await expect(
      reverseOverstayChargeOnExtend(admin as never, {
        hotelId: 'h1',
        reservationId: 'r1',
        guestId: 'g1',
      }),
    ).resolves.toEqual({ reversed: false, amount: 0 })
  })
})

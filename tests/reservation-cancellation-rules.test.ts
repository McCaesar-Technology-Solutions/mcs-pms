import { describe, expect, it } from 'vitest'
import { applyCancellationRules } from '@/lib/reservations/cancellation-rules'

const hotelSettings = {
  default_free_cancel_days: 7,
  default_refundable: true,
  default_penalty_nights: 1,
}

const baseReservation = {
  id: '11111111-1111-4111-8111-111111111111',
  hotel_id: '22222222-2222-4222-8222-222222222222',
  check_in: '2026-07-01',
  amount_paid: 300,
  total_amount: 600,
  nightly_rate: 200,
}

describe('applyCancellationRules', () => {
  it('grants full refund inside free cancellation window', async () => {
    const result = await applyCancellationRules({} as never, {
      reservation: baseReservation,
      hotelSettings,
      cancelledAt: new Date('2026-06-20T12:00:00Z'),
      actorId: 'a',
      actorRole: 'staff',
    })
    expect(result.policyApplied).toBe('free_cancellation_window')
    expect(result.refundAmount).toBe(300)
    expect(result.penaltyAmount).toBe(0)
  })

  it('retains full payment on non-refundable rate', async () => {
    const result = await applyCancellationRules({} as never, {
      reservation: baseReservation,
      hotelSettings: { ...hotelSettings, default_refundable: false },
      cancelledAt: new Date('2026-06-28T12:00:00Z'),
      actorId: 'a',
      actorRole: 'staff',
    })
    expect(result.policyApplied).toBe('non_refundable_rate')
    expect(result.refundAmount).toBe(0)
    expect(result.penaltyAmount).toBe(300)
  })

  it('rejects force majeure without documentation URL', async () => {
    const result = await applyCancellationRules({} as never, {
      reservation: baseReservation,
      hotelSettings,
      cancelledAt: new Date(),
      forceMajeure: true,
      actorId: 'a',
      actorRole: 'manager',
    })
    expect(result.canCancel).toBe(false)
    expect(result.requiresManagerApproval).toBe(true)
  })

  it('flags force majeure with documentation for manager approval', async () => {
    const result = await applyCancellationRules({} as never, {
      reservation: baseReservation,
      hotelSettings,
      cancelledAt: new Date(),
      forceMajeure: true,
      forceMajeureDocUrl: 'https://example.com/doc.pdf',
      actorId: 'a',
      actorRole: 'manager',
    })
    expect(result.canCancel).toBe(true)
    expect(result.requiresManagerApproval).toBe(true)
    expect(result.refundAmount).toBe(300)
  })
})

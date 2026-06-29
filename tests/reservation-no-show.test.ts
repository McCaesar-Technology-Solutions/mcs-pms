import { describe, expect, it } from 'vitest'
import {
  guestInHouseOnOtherReservation,
  hasRecentOtaCancellation,
  shouldMarkOverstay,
} from '@/lib/cron/reservation-lifecycle-guards'

describe('no-show guards', () => {
  it('skips when guest is in-house on another reservation', () => {
    expect(guestInHouseOnOtherReservation(['guest-1'], 'guest-1')).toBe(true)
    expect(guestInHouseOnOtherReservation(['guest-2'], 'guest-1')).toBe(false)
    expect(guestInHouseOnOtherReservation([], null)).toBe(false)
  })

  it('skips on recent OTA cancellation event', () => {
    const now = new Date('2026-06-15T12:00:00Z')
    expect(
      hasRecentOtaCancellation(
        [{ event_type: 'ota_cancellation_received', created_at: '2026-06-15T11:30:00Z' }],
        now,
      ),
    ).toBe(true)
    expect(
      hasRecentOtaCancellation(
        [{ event_type: 'ota_cancellation_received', created_at: '2026-06-15T08:00:00Z' }],
        now,
      ),
    ).toBe(false)
  })
})

describe('overstay guards', () => {
  const today = '2026-06-15'

  it('does not mark overstay when late checkout approved', () => {
    expect(
      shouldMarkOverstay({
        status: 'checked_in',
        departureDate: today,
        today,
        pastCheckoutTime: true,
        events: [{ event_type: 'late_checkout_approved', created_at: today }],
      }),
    ).toBe(false)
  })

  it('marks overstay when past checkout with no approval or checkout start', () => {
    expect(
      shouldMarkOverstay({
        status: 'checked_in',
        departureDate: today,
        today,
        pastCheckoutTime: true,
        events: [],
      }),
    ).toBe(true)
  })

  it('skips when checkout already initiated', () => {
    expect(
      shouldMarkOverstay({
        status: 'checked_in',
        departureDate: today,
        today,
        pastCheckoutTime: true,
        events: [{ event_type: 'checkout_initiated', created_at: today }],
      }),
    ).toBe(false)
  })
})

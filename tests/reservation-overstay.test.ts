import { describe, expect, it } from 'vitest'
import { shouldAutoCheckoutPrompt, shouldMarkOverstay } from '@/lib/cron/reservation-lifecycle-guards'

describe('reservation overstay cron', () => {
  const today = '2026-06-15'

  it('auto-checkout prompt applies before overstay when no checkout event', () => {
    const input = {
      status: 'checked_in',
      departureDate: today,
      today,
      pastCheckoutTime: true,
      events: [] as { event_type: string; created_at: string }[],
    }
    expect(shouldAutoCheckoutPrompt(input)).toBe(true)
    expect(shouldMarkOverstay(input)).toBe(true)
  })

  it('overstay skipped after checkout initiated', () => {
    const events = [{ event_type: 'checkout_initiated', created_at: `${today}T12:00:00Z` }]
    expect(
      shouldMarkOverstay({
        status: 'checked_in',
        departureDate: today,
        today,
        pastCheckoutTime: true,
        events,
      }),
    ).toBe(false)
    expect(
      shouldAutoCheckoutPrompt({
        status: 'checked_in',
        departureDate: today,
        today,
        pastCheckoutTime: true,
        events,
      }),
    ).toBe(false)
  })
})

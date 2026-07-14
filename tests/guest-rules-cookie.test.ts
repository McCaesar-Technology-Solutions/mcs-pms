import { describe, expect, it } from 'vitest'
import { createGuestSessionToken, parseGuestSessionToken } from '@/lib/guest-session'

describe('guest rules ack cookie signing', () => {
  it('uses the same HMAC pattern as guest sessions', async () => {
    process.env.GUEST_SESSION_SECRET = 'test-guest-secret'

    const guestToken = await createGuestSessionToken(
      '00000000-0000-4000-8000-000000000099',
      new Date(Date.now() + 60_000),
    )
    expect(guestToken.split('.')).toHaveLength(3)

    const parsed = await parseGuestSessionToken(guestToken)
    expect(parsed?.guestId).toBe('00000000-0000-4000-8000-000000000099')
  })
})

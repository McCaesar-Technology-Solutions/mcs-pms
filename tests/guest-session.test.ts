import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  createGuestSessionToken,
  parseGuestSessionToken,
} from '@/lib/guest-session'

describe('guest session tokens', () => {
  const prev = process.env.GUEST_SESSION_SECRET

  beforeEach(() => {
    process.env.GUEST_SESSION_SECRET = 'test-secret-for-guest-session'
  })

  afterEach(() => {
    process.env.GUEST_SESSION_SECRET = prev
  })

  it('round-trips a signed guest session', async () => {
    const expiresAt = new Date(Date.now() + 60_000)
    const token = await createGuestSessionToken('guest-uuid-123', expiresAt)
    const parsed = await parseGuestSessionToken(token)
    expect(parsed?.guestId).toBe('guest-uuid-123')
  })

  it('rejects tampered tokens', async () => {
    const expiresAt = new Date(Date.now() + 60_000)
    const token = await createGuestSessionToken('guest-uuid-123', expiresAt)
    const tampered = token.slice(0, -2) + 'ff'
    expect(await parseGuestSessionToken(tampered)).toBeNull()
  })

  it('rejects expired tokens', async () => {
    const expiresAt = new Date(Date.now() - 1_000)
    const token = await createGuestSessionToken('guest-uuid-123', expiresAt)
    expect(await parseGuestSessionToken(token)).toBeNull()
  })

  it('rejects malformed token shapes', async () => {
    expect(await parseGuestSessionToken('not-a-valid-token')).toBeNull()
    expect(await parseGuestSessionToken('a.b')).toBeNull()
  })
})

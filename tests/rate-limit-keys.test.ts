import { describe, expect, it } from 'vitest'
import { guestRateKey, ipRateKey } from '@/lib/rate-limit'

describe('rate limit keys', () => {
  it('builds stable guest keys', () => {
    expect(guestRateKey('message', 'guest-1')).toBe('guest:message:guest-1')
  })

  it('builds ip scoped keys', () => {
    expect(ipRateKey('portal-entry', 'slug:101')).toBe('ip:portal-entry:slug:101')
  })
})

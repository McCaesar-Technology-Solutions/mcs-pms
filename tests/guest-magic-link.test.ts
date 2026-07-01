import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { getClientIpFromRequest } from '@/lib/auth/client-ip'
import { GUEST_RATE_LIMITS } from '@/lib/rate-limit'

describe('getClientIpFromRequest', () => {
  it('reads the first x-forwarded-for hop', () => {
    const req = new NextRequest('http://localhost/guest/enter', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    })
    expect(getClientIpFromRequest(req)).toBe('203.0.113.1')
  })

  it('falls back to x-real-ip', () => {
    const req = new NextRequest('http://localhost/guest/enter', {
      headers: { 'x-real-ip': '198.51.100.2' },
    })
    expect(getClientIpFromRequest(req)).toBe('198.51.100.2')
  })
})

describe('guest magic-link rate limits', () => {
  it('defines per-ip and per-token budgets', () => {
    expect(GUEST_RATE_LIMITS.magicLinkEnter.max).toBeGreaterThan(0)
    expect(GUEST_RATE_LIMITS.magicLinkEnterIp.max).toBeGreaterThan(
      GUEST_RATE_LIMITS.magicLinkEnter.max,
    )
  })
})

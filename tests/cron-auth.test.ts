import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  getCronSecret: () => 'super-secret-cron-key',
}))

import { authorizeCron } from '@/lib/cron/maintenance'

describe('authorizeCron', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('accepts a valid bearer token', () => {
    const request = new Request('http://localhost/api/cron/cleanup', {
      headers: { authorization: 'Bearer super-secret-cron-key' },
    })
    expect(authorizeCron(request)).toBe(true)
  })

  it('rejects missing or wrong authorization', () => {
    expect(authorizeCron(new Request('http://localhost/api/cron/cleanup'))).toBe(false)
    expect(
      authorizeCron(
        new Request('http://localhost/api/cron/cleanup', {
          headers: { authorization: 'Bearer wrong-key' },
        }),
      ),
    ).toBe(false)
  })

  it('rejects prefix-only partial matches', () => {
    expect(
      authorizeCron(
        new Request('http://localhost/api/cron/cleanup', {
          headers: { authorization: 'Bearer super-secret-cron-ke' },
        }),
      ),
    ).toBe(false)
  })
})

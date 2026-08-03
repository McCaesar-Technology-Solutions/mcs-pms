import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  employeeNoFromGuestId,
  generateAgentToken,
  hashAgentToken,
  verifyAgentToken,
} from '@/lib/access/crypto'
import { isAgentOnline } from '@/lib/access/agent-auth'

describe('access crypto', () => {
  it('hashes and verifies agent tokens with timing-safe compare', () => {
    const { token, hash, prefix } = generateAgentToken()
    expect(prefix.length).toBeGreaterThan(8)
    expect(hash).toBe(hashAgentToken(token))
    expect(verifyAgentToken(token, hash)).toBe(true)
    expect(verifyAgentToken(token + 'x', hash)).toBe(false)
    expect(verifyAgentToken(token, createHash('sha256').update('other').digest('hex'))).toBe(false)
  })

  it('derives a stable numeric employee number from guest id', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const a = employeeNoFromGuestId(id)
    const b = employeeNoFromGuestId(id)
    expect(a).toBe(b)
    expect(a).toMatch(/^\d{9}$/)
  })
})

describe('agent online window', () => {
  it('treats recent heartbeats as online', () => {
    expect(isAgentOnline(new Date().toISOString())).toBe(true)
    expect(isAgentOnline(new Date(Date.now() - 10 * 60_000).toISOString())).toBe(false)
    expect(isAgentOnline(null)).toBe(false)
  })
})

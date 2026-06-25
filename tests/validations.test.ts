import { describe, expect, it } from 'vitest'
import {
  inviteStaffSchema,
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
} from '@/lib/validations'

describe('signInSchema', () => {
  it('accepts a valid email + password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.com', password: 'secret12' }).success).toBe(true)
  })

  it('rejects bad email or short password', () => {
    expect(signInSchema.safeParse({ email: 'nope', password: 'secret1' }).success).toBe(false)
    expect(signInSchema.safeParse({ email: 'a@b.com', password: '123' }).success).toBe(false)
  })
})

describe('inviteStaffSchema', () => {
  it('requires an email for managers and receptionists', () => {
    expect(inviteStaffSchema.safeParse({ role: 'manager', email: 'm@b.com' }).success).toBe(true)
    expect(inviteStaffSchema.safeParse({ role: 'receptionist', email: 'r@b.com' }).success).toBe(
      true,
    )
    expect(inviteStaffSchema.safeParse({ role: 'receptionist' }).success).toBe(false)
  })

  it('requires a phone for technicians', () => {
    expect(inviteStaffSchema.safeParse({ role: 'technician', phone: '0241234567' }).success).toBe(
      true,
    )
    expect(inviteStaffSchema.safeParse({ role: 'technician' }).success).toBe(false)
  })

  it('rejects unknown roles', () => {
    expect(inviteStaffSchema.safeParse({ role: 'owner', email: 'o@b.com' }).success).toBe(false)
  })
})

describe('requestResetSchema', () => {
  it('validates email', () => {
    expect(requestResetSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
    expect(requestResetSchema.safeParse({ email: 'bad' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  it('requires matching passwords of 8+ characters', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'longenough', confirm: 'longenough' }).success,
    ).toBe(true)
  })

  it('rejects mismatches and short passwords', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'longenough', confirm: 'different1' }).success,
    ).toBe(false)
    expect(resetPasswordSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(
      false,
    )
  })
})

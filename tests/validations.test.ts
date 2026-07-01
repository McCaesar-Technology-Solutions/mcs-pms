import { describe, expect, it } from 'vitest'
import {
  inviteStaffSchema,
  requestResetSchema,
  resetPasswordSchema,
  signInSchema,
  signUpOwnerSchema,
  acceptInviteSchema,
} from '@/lib/validations'

const VALID_NEW_PASSWORD = 'validpass123'

describe('signInSchema', () => {
  it('accepts a valid email + password', () => {
    expect(signInSchema.safeParse({ identifier: 'a@b.com', password: 'legacy8c' }).success).toBe(
      true,
    )
  })

  it('accepts a valid phone + password', () => {
    expect(signInSchema.safeParse({ identifier: '+233241234567', password: 'legacy8c' }).success).toBe(
      true,
    )
  })

  it('rejects bad identifier or empty password', () => {
    expect(signInSchema.safeParse({ identifier: 'nope', password: 'legacy8c' }).success).toBe(false)
    expect(signInSchema.safeParse({ identifier: 'a@b.com', password: '' }).success).toBe(false)
    expect(signInSchema.safeParse({ identifier: 'not-an-email', password: 'legacy8c' }).success).toBe(
      false,
    )
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
  it('requires matching passwords of 12+ characters', () => {
    expect(
      resetPasswordSchema.safeParse({ password: VALID_NEW_PASSWORD, confirm: VALID_NEW_PASSWORD })
        .success,
    ).toBe(true)
  })

  it('rejects mismatches and short passwords', () => {
    expect(
      resetPasswordSchema.safeParse({ password: VALID_NEW_PASSWORD, confirm: 'different123' })
        .success,
    ).toBe(false)
    expect(resetPasswordSchema.safeParse({ password: 'short', confirm: 'short' }).success).toBe(
      false,
    )
  })
})

describe('signUpOwnerSchema', () => {
  it('requires matching confirm password', () => {
    expect(
      signUpOwnerSchema.safeParse({
        name: 'Ada',
        email: 'ada@example.com',
        password: VALID_NEW_PASSWORD,
        confirmPassword: VALID_NEW_PASSWORD,
      }).success,
    ).toBe(true)

    expect(
      signUpOwnerSchema.safeParse({
        name: 'Ada',
        email: 'ada@example.com',
        password: VALID_NEW_PASSWORD,
        confirmPassword: 'different123',
      }).success,
    ).toBe(false)
  })

  it('rejects passwords shorter than 12 characters', () => {
    expect(
      signUpOwnerSchema.safeParse({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'onlyeleven',
        confirmPassword: 'onlyeleven',
      }).success,
    ).toBe(false)
  })
})

describe('acceptInviteSchema', () => {
  it('requires matching confirm password', () => {
    expect(
      acceptInviteSchema.safeParse({
        token: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Kofi',
        password: VALID_NEW_PASSWORD,
        confirmPassword: VALID_NEW_PASSWORD,
        phone: '0241234567',
      }).success,
    ).toBe(true)

    expect(
      acceptInviteSchema.safeParse({
        token: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Kofi',
        password: VALID_NEW_PASSWORD,
        confirmPassword: 'mismatch12',
        phone: '0241234567',
      }).success,
    ).toBe(false)
  })
})

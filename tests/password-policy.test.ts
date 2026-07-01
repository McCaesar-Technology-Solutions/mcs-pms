import { describe, expect, it } from 'vitest'
import { PASSWORD_MIN_LENGTH, newPasswordFieldSchema } from '@/lib/auth/password-policy'

describe('password policy', () => {
  it('requires 12 characters for new passwords', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12)
    expect(newPasswordFieldSchema.safeParse('short').success).toBe(false)
    expect(newPasswordFieldSchema.safeParse('twelvechars!').success).toBe(true)
  })
})

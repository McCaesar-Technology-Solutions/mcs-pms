import { describe, expect, it } from 'vitest'
import { validateInHouseEnrollmentDates } from '@/lib/guests/enroll-in-house'
import { enrollGuestSchema } from '@/lib/validations'

describe('validateInHouseEnrollmentDates', () => {
  const today = '2026-08-12'

  it('accepts a past arrival with a future departure', () => {
    expect(validateInHouseEnrollmentDates('2026-08-01', '2026-08-20', today)).toEqual({
      ok: true,
    })
  })

  it('accepts arrival today with departure tomorrow', () => {
    expect(validateInHouseEnrollmentDates(today, '2026-08-13', today)).toEqual({ ok: true })
  })

  it('rejects future arrival', () => {
    const result = validateInHouseEnrollmentDates('2026-08-15', '2026-08-20', today)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/today or earlier/i)
  })

  it('rejects departure today or earlier', () => {
    const sameDay = validateInHouseEnrollmentDates('2026-08-01', today, today)
    expect(sameDay.ok).toBe(false)
    if (!sameDay.ok) expect(sameDay.error).toMatch(/no longer in house/i)

    const past = validateInHouseEnrollmentDates('2026-08-01', '2026-08-10', today)
    expect(past.ok).toBe(false)
  })

  it('rejects departure on or before arrival', () => {
    const result = validateInHouseEnrollmentDates('2026-08-10', '2026-08-10', today)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/after arrival/i)
  })
})

describe('enrollGuestSchema', () => {
  const base = {
    name: 'Ama Mensah',
    phone: '0241234567',
    roomId: '11111111-1111-4111-8111-111111111111',
    checkIn: '2026-08-01',
    checkOut: '2026-08-20',
  }

  it('accepts a complete in-house enrollment payload', () => {
    expect(enrollGuestSchema.safeParse(base).success).toBe(true)
  })

  it('requires phone and room', () => {
    expect(enrollGuestSchema.safeParse({ ...base, phone: '' }).success).toBe(false)
    expect(enrollGuestSchema.safeParse({ ...base, roomId: 'bad' }).success).toBe(false)
  })

  it('defaults rate type to nightly', () => {
    const parsed = enrollGuestSchema.safeParse(base)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.rateType).toBe('nightly')
  })
})

import { describe, expect, it } from 'vitest'
import { assessGtaLicense, gtaAlertIdempotencyKey } from '@/lib/compliance/gta-license'

describe('assessGtaLicense', () => {
  it('flags missing license details', () => {
    const result = assessGtaLicense({ licenseNumber: '', expiryDate: '' })
    expect(result.status).toBe('missing')
    expect(result.message).toBeTruthy()
  })

  it('flags expired license', () => {
    const result = assessGtaLicense({
      licenseNumber: 'GTA-001',
      expiryDate: '2020-01-01',
      today: '2026-06-15',
    })
    expect(result.status).toBe('expired')
    expect(result.daysUntilExpiry).toBeLessThan(0)
  })

  it('flags critical expiry within 7 days', () => {
    const result = assessGtaLicense({
      licenseNumber: 'GTA-001',
      expiryDate: '2026-06-20',
      today: '2026-06-15',
    })
    expect(result.status).toBe('expiring_critical')
    expect(result.daysUntilExpiry).toBe(5)
  })

  it('flags soon expiry within 30 days', () => {
    const result = assessGtaLicense({
      licenseNumber: 'GTA-001',
      expiryDate: '2026-07-01',
      today: '2026-06-15',
    })
    expect(result.status).toBe('expiring_soon')
  })

  it('accepts valid license', () => {
    const result = assessGtaLicense({
      licenseNumber: 'GTA-001',
      expiryDate: '2027-01-01',
      today: '2026-06-15',
    })
    expect(result.status).toBe('valid')
    expect(result.message).toBeNull()
  })
})

describe('gtaAlertIdempotencyKey', () => {
  it('is stable for the same hotel and tier', () => {
    const key = gtaAlertIdempotencyKey('hotel-1', '2026-07-01', 'soon')
    expect(key).toBe('gta:hotel-1:2026-07-01:soon')
  })
})

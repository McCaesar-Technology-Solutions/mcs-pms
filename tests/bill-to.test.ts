import { describe, expect, it } from 'vitest'
import { resolveBillToName, displayBillToName } from '@/lib/billing/bill-to'

describe('resolveBillToName', () => {
  it('keeps existing name when the popup omits bill-to fields (refresh)', () => {
    expect(
      resolveBillToName({ guestName: 'Ama', existing: 'Acme Ltd' }),
    ).toEqual({ ok: true, value: 'Acme Ltd' })
  })

  it('stores null when bill-to is the same as the guest', () => {
    expect(
      resolveBillToName({ guestName: 'Ama Mensah', billToSameAsGuest: true }),
    ).toEqual({ ok: true, value: null })
    expect(
      resolveBillToName({
        guestName: 'Ama Mensah',
        billToSameAsGuest: false,
        billToName: 'ama mensah',
      }),
    ).toEqual({ ok: true, value: null })
  })

  it('requires a name when bill-to is not the guest', () => {
    expect(
      resolveBillToName({ guestName: 'Ama', billToSameAsGuest: false, billToName: '' }),
    ).toEqual({ ok: false, error: 'Enter the bill-to name.' })
    expect(
      resolveBillToName({
        guestName: 'Ama',
        billToSameAsGuest: false,
        billToName: '  Acme Ltd  ',
      }),
    ).toEqual({ ok: true, value: 'Acme Ltd' })
  })
})

describe('displayBillToName', () => {
  it('falls back to the guest', () => {
    expect(displayBillToName('Ama', null)).toBe('Ama')
    expect(displayBillToName('Ama', 'Acme Ltd')).toBe('Acme Ltd')
  })
})

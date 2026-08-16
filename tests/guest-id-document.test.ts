import { describe, expect, it } from 'vitest'
import {
  EMPTY_GUEST_ID_DOCUMENT,
  formatGuestIdDocument,
  guestIdDocumentColumns,
  guestIdDocumentFromRow,
  guestIdDocumentHasValue,
  parseGuestIdDocument,
} from '@/lib/guests/id-document'

describe('guest ID document', () => {
  it('treats empty fields as no ID', () => {
    expect(parseGuestIdDocument({})).toEqual({ ok: true, value: EMPTY_GUEST_ID_DOCUMENT })
    expect(parseGuestIdDocument({ type: 'none', number: '', country: '' })).toEqual({
      ok: true,
      value: EMPTY_GUEST_ID_DOCUMENT,
    })
  })

  it('requires a type when a number is present', () => {
    const result = parseGuestIdDocument({ number: 'A1234567' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Select an ID type/)
  })

  it('requires a number when a type is selected', () => {
    const result = parseGuestIdDocument({ type: 'passport' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Passport number/)
  })

  it('parses Ghana Card and dual-writes ghana_card_number', () => {
    const parsed = parseGuestIdDocument({
      type: 'ghana_card',
      number: 'gha-728071939-8',
    })
    expect(parsed).toEqual({
      ok: true,
      value: { type: 'ghana_card', number: 'GHA-728071939-8', country: 'GH' },
    })
    if (!parsed.ok) return
    expect(guestIdDocumentColumns(parsed.value)).toEqual({
      id_document_type: 'ghana_card',
      id_document_number: 'GHA-728071939-8',
      id_document_country: 'GH',
      ghana_card_number: 'GHA-728071939-8',
    })
  })

  it('rejects a malformed Ghana Card', () => {
    const result = parseGuestIdDocument({ type: 'ghana_card', number: 'GHA-123-4' })
    expect(result.ok).toBe(false)
  })

  it('normalizes passport numbers and optional country', () => {
    expect(
      parseGuestIdDocument({ type: 'passport', number: 'ab 123456', country: 'gb' }),
    ).toEqual({
      ok: true,
      value: { type: 'passport', number: 'AB123456', country: 'GB' },
    })
    expect(parseGuestIdDocument({ type: 'passport', number: 'AB123456' })).toEqual({
      ok: true,
      value: { type: 'passport', number: 'AB123456', country: null },
    })
  })

  it('rejects short or invalid passport numbers', () => {
    const result = parseGuestIdDocument({ type: 'passport', number: 'AB12' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/6–12/)
  })

  it('normalizes driver’s licence numbers', () => {
    expect(
      parseGuestIdDocument({
        type: 'drivers_license',
        number: 'dl 12-345',
        country: 'ng',
      }),
    ).toEqual({
      ok: true,
      value: { type: 'drivers_license', number: 'DL12-345', country: 'NG' },
    })
  })

  it('clears ghana_card_number when the ID is not a Ghana Card', () => {
    const parsed = parseGuestIdDocument({ type: 'passport', number: 'A1234567' })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(guestIdDocumentColumns(parsed.value).ghana_card_number).toBeNull()
  })

  it('reads new columns first and falls back to ghana_card_number', () => {
    expect(
      guestIdDocumentFromRow({
        id_document_type: 'passport',
        id_document_number: 'A1234567',
        id_document_country: 'gb',
        ghana_card_number: 'GHA-728071939-8',
      }),
    ).toEqual({ type: 'passport', number: 'A1234567', country: 'GB' })

    expect(
      guestIdDocumentFromRow({ ghana_card_number: 'GHA-728071939-8' }),
    ).toEqual({ type: 'ghana_card', number: 'GHA-728071939-8', country: 'GH' })
  })

  it('formats for staff display', () => {
    expect(formatGuestIdDocument(EMPTY_GUEST_ID_DOCUMENT)).toBe('No ID on file')
    expect(
      formatGuestIdDocument({ type: 'ghana_card', number: 'GHA-728071939-8', country: 'GH' }),
    ).toBe('Ghana Card · GHA-728071939-8')
    expect(
      formatGuestIdDocument({ type: 'passport', number: 'A1234567', country: 'GB' }),
    ).toBe('Passport (GB) · A1234567')
    expect(guestIdDocumentHasValue({ type: 'passport', number: 'A1234567', country: null })).toBe(
      true,
    )
    expect(guestIdDocumentHasValue(EMPTY_GUEST_ID_DOCUMENT)).toBe(false)
  })

  it('rejects invalid ID on enroll schema before a stay is created', async () => {
    const { enrollGuestSchema } = await import('@/lib/validations')
    const result = enrollGuestSchema.safeParse({
      name: 'Ama Mensah',
      phone: '+233201234567',
      roomId: '11111111-1111-4111-8111-111111111111',
      checkIn: '2026-08-01',
      checkOut: '2026-08-03',
      idDocumentType: 'passport',
      idDocumentNumber: 'AB12',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/6–12/)
    }
  })
})

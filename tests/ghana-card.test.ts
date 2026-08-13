import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INVOICE_TAX_ID,
  ghanaCardInputSchema,
  isValidGhanaCard,
  normalizeGhanaCard,
  parseGhanaCard,
  resolveInvoiceTaxId,
} from '@/lib/billing/ghana-card'

describe('ghana card', () => {
  it('accepts canonical GHA-#########-#', () => {
    expect(parseGhanaCard('GHA-728071939-8')).toEqual({
      ok: true,
      value: 'GHA-728071939-8',
    })
    expect(isValidGhanaCard('GHA-728071939-8')).toBe(true)
  })

  it('normalizes lowercase and digit-only forms', () => {
    expect(normalizeGhanaCard('gha-728071939-8')).toBe('GHA-728071939-8')
    expect(normalizeGhanaCard('GHA7280719398')).toBe('GHA-728071939-8')
    expect(normalizeGhanaCard('  7280719398  ')).toBe('GHA-728071939-8')
  })

  it('treats empty as null', () => {
    expect(parseGhanaCard('')).toEqual({ ok: true, value: null })
    expect(parseGhanaCard('   ')).toEqual({ ok: true, value: null })
    expect(parseGhanaCard(null)).toEqual({ ok: true, value: null })
  })

  it('rejects malformed values', () => {
    const bad = parseGhanaCard('GHA-123-4')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/GHA-728071939-8/)
  })

  it('zod schema rejects bad cards before create flows', () => {
    expect(ghanaCardInputSchema.safeParse('GHA-123-4').success).toBe(false)
    expect(ghanaCardInputSchema.safeParse('GHA-728071939-8').success).toBe(true)
    expect(ghanaCardInputSchema.safeParse('').success).toBe(true)
    expect(ghanaCardInputSchema.safeParse(undefined).success).toBe(true)
  })

  it('stamps the hotel default Tax ID on every taxed invoice', () => {
    expect(DEFAULT_INVOICE_TAX_ID).toBe('GHA-728071939-8')
    expect(resolveInvoiceTaxId(true)).toBe('GHA-728071939-8')
    expect(resolveInvoiceTaxId(false)).toBeNull()
  })
})

/** Ghana Card / NIA number. Guest record identity only — invoice Tax ID uses resolveInvoiceTaxId. */

import { z } from 'zod'

const GHANA_CARD_RE = /^GHA-\d{9}-\d$/

/**
 * Default Bill-to Tax ID stamped on every taxed invoice (hotel policy).
 * Guest Ghana Card is still captured for records; invoice Tax ID uses this value when tax applies.
 */
export const DEFAULT_INVOICE_TAX_ID = 'GHA-728071939-8'

/** Tax ID written to invoices when GRA taxes are included. */
export function resolveInvoiceTaxId(includeTax: boolean): string | null {
  return includeTax ? DEFAULT_INVOICE_TAX_ID : null
}

/**
 * Normalize common input shapes to `GHA-#########-#`.
 * Empty / whitespace → null.
 */
export function normalizeGhanaCard(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (!trimmed) return null

  if (GHANA_CARD_RE.test(trimmed)) return trimmed

  const digits = trimmed.replace(/^GHA-?/, '').replace(/-/g, '')
  if (/^\d{10}$/.test(digits)) {
    return `GHA-${digits.slice(0, 9)}-${digits.slice(9)}`
  }

  return trimmed
}

export function isValidGhanaCard(value: string): boolean {
  return GHANA_CARD_RE.test(value)
}

export function parseGhanaCard(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const normalized = normalizeGhanaCard(raw)
  if (normalized == null) return { ok: true, value: null }
  if (!isValidGhanaCard(normalized)) {
    return { ok: false, error: 'Ghana Card must look like GHA-728071939-8.' }
  }
  return { ok: true, value: normalized }
}

/**
 * Zod field for forms/actions.
 * - `undefined` → leave existing guest card unchanged (omit from update)
 * - `''` / null → clear (null)
 * - invalid shape → validation error
 */
export const ghanaCardInputSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined
    const parsed = parseGhanaCard(v)
    if (!parsed.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error })
      return z.NEVER
    }
    return parsed.value
  })

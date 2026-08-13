/** Ghana Card / NIA number used as guest tax ID on invoices. */

const GHANA_CARD_RE = /^GHA-\d{9}-\d$/

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

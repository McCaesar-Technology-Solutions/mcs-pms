/**
 * Bill-to name may differ from the stay guest (company, sponsor, parent).
 * Null on the invoice means “same as guest”.
 */

export function resolveBillToName(input: {
  guestName: string
  existing?: string | null
  billToSameAsGuest?: boolean
  billToName?: string | null
}): { ok: true; value: string | null } | { ok: false; error: string } {
  const guest = input.guestName.trim()
  const omitted =
    input.billToSameAsGuest === undefined &&
    (input.billToName === undefined || input.billToName === null)

  if (omitted) {
    return { ok: true, value: input.existing?.trim() || null }
  }

  if (input.billToSameAsGuest !== false) {
    return { ok: true, value: null }
  }

  const name = (input.billToName ?? '').trim()
  if (name.length < 2) {
    return { ok: false, error: 'Enter the bill-to name.' }
  }
  if (name.toLowerCase() === guest.toLowerCase()) {
    return { ok: true, value: null }
  }
  return { ok: true, value: name }
}

export function displayBillToName(guestName: string, billToName?: string | null): string {
  const name = billToName?.trim()
  return name || guestName
}

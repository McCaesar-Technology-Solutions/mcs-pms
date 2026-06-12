/** Hubtel sender nickname rules (see Hubtel SMS docs). */
const FORBIDDEN_SENDER_CHARS = /[\s_/&@."',*#+!?]/

/** Alphanumeric nickname: max 11 chars, no spaces or special symbols. */
const ALPHANUMERIC_SENDER = /^[A-Za-z0-9]{1,11}$/

/** Numeric sender ID in international format: digits only, max 16. */
const NUMERIC_SENDER = /^[0-9]{1,16}$/

export function validateHubtelSenderId(sender: string): { ok: true } | { ok: false; error: string } {
  const trimmed = sender.trim()
  if (!trimmed) {
    return { ok: false, error: 'Hubtel sender ID is required.' }
  }

  if (FORBIDDEN_SENDER_CHARS.test(trimmed)) {
    return {
      ok: false,
      error:
        'Hubtel sender ID cannot contain spaces or these characters: _ / & @ . " \' , * # + ! ?',
    }
  }

  if (NUMERIC_SENDER.test(trimmed)) {
    return { ok: true }
  }

  if (ALPHANUMERIC_SENDER.test(trimmed)) {
    return { ok: true }
  }

  if (/^[0-9]+$/.test(trimmed)) {
    return { ok: false, error: 'Numeric Hubtel sender ID must be at most 16 digits.' }
  }

  return {
    ok: false,
    error: 'Hubtel sender ID must be 1–11 letters/numbers, or 1–16 digits (e.g. 233244200001).',
  }
}

export function resolveHubtelSenderId(): string {
  return (process.env.HUBTEL_SENDER_ID ?? 'MOJO').trim()
}

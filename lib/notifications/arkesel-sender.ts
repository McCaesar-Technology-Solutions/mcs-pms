import { validateHubtelSenderId } from '@/lib/notifications/hubtel-sender'

/** Arkesel uses the same sender ID rules as Hubtel (max 11 alphanumeric). */
export function validateArkeselSenderId(sender: string): { ok: true } | { ok: false; error: string } {
  const result = validateHubtelSenderId(sender)
  if (!result.ok) {
    return { ok: false, error: result.error.replace(/Hubtel/g, 'Arkesel') }
  }
  return result
}

export function resolveArkeselSenderId(): string {
  return (process.env.ARKESEL_SENDER_ID ?? 'MOJO').trim()
}

/** Arkesel expects international format without a leading + (e.g. 233244123456). */
export function toArkeselRecipient(e164: string): string {
  return e164.replace(/^\+/, '')
}

import { getGuestSessionSecret } from '@/lib/env'
import { normalizePortalPin } from '@/lib/guest/portal-pin'

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256Hex(message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getGuestSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bufferToHex(sig)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/** HMAC-SHA256 of guestId + PIN — never store plaintext PINs. */
export async function hashPortalPin(guestId: string, pin: string): Promise<string> {
  const normalized = normalizePortalPin(pin)
  return hmacSha256Hex(`portal-pin:${guestId}:${normalized}`)
}

export async function verifyPortalPin(
  guestId: string,
  pinInput: string,
  storedHash: string | null | undefined,
  legacyPlain: string | null | undefined,
): Promise<boolean> {
  const pin = normalizePortalPin(pinInput)
  if (!pin) return false

  if (storedHash) {
    const expected = await hashPortalPin(guestId, pin)
    return timingSafeEqualHex(expected, storedHash)
  }

  if (legacyPlain) {
    return pin === normalizePortalPin(legacyPlain)
  }

  return false
}

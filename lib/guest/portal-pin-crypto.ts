import { getGuestSessionSecret } from '@/lib/env'
import { normalizePortalPin, PORTAL_PIN_LENGTH } from '@/lib/guest/portal-pin'

const SEAL_PREFIX = 'enc:v1:'

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
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
  return bytesToHex(sig)
}

async function deriveSealKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(`portal-pin-seal:${getGuestSessionSecret()}`),
  )
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/** True when portal_pin still holds a legacy plaintext numeric PIN. */
export function isLegacyPlainPortalPin(stored: string | null | undefined): boolean {
  if (!stored) return false
  return /^\d{4,6}$/.test(stored.trim())
}

/** HMAC-SHA256 of guestId + PIN for verification. */
export async function hashPortalPin(guestId: string, pin: string): Promise<string> {
  const normalized = normalizePortalPin(pin)
  return hmacSha256Hex(`portal-pin:${guestId}:${normalized}`)
}

/**
 * Encrypt a portal PIN for staff display later.
 * Verification still uses portal_pin_hash — this is only so front desk can re-show the code.
 */
export async function sealPortalPin(pin: string): Promise<string> {
  const normalized = normalizePortalPin(pin)
  if (normalized.length !== PORTAL_PIN_LENGTH) {
    throw new Error('Portal PIN must be 6 digits before sealing')
  }
  const key = await deriveSealKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(normalized),
  )
  return `${SEAL_PREFIX}${bytesToHex(iv)}.${bytesToHex(ciphertext)}`
}

/** Reveal a stored portal PIN (sealed ciphertext or legacy plaintext). */
export async function revealStoredPortalPin(
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored?.trim()) return null
  const trimmed = stored.trim()
  if (isLegacyPlainPortalPin(trimmed)) return trimmed
  if (!trimmed.startsWith(SEAL_PREFIX)) return null

  const body = trimmed.slice(SEAL_PREFIX.length)
  const [ivHex, cipherHex] = body.split('.')
  if (!ivHex || !cipherHex) return null
  const iv = hexToBytes(ivHex)
  const cipher = hexToBytes(cipherHex)
  if (!iv || !cipher) return null

  try {
    const key = await deriveSealKey()
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    const pin = new TextDecoder().decode(plain)
    return normalizePortalPin(pin) || null
  } catch {
    return null
  }
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

  if (legacyPlain && isLegacyPlainPortalPin(legacyPlain)) {
    return pin === normalizePortalPin(legacyPlain)
  }

  return false
}

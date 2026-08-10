import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getMfaOtpSecret } from '@/lib/env'

/** SHA-256 hex digest for agent bearer tokens (never store plaintext). */
export function hashAgentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateAgentToken(): { token: string; prefix: string; hash: string } {
  const token = `mojo_ac_${randomBytes(32).toString('base64url')}`
  return {
    token,
    prefix: token.slice(0, 16),
    hash: hashAgentToken(token),
  }
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length || ba.length === 0) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

export function verifyAgentToken(presented: string, storedHash: string): boolean {
  return timingSafeEqualHex(hashAgentToken(presented), storedHash)
}

/**
 * Encrypt short secrets (door PIN) in job payloads at rest.
 * Reuses MFA_OTP_SECRET material — same production secret already required.
 */
async function deriveAesKey(): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getMfaOtpSecret()))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

export async function encryptAccessSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey()
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return `enc:${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`
}

export async function decryptAccessSecret(payload: string): Promise<string | null> {
  if (!payload.startsWith('enc:')) return payload
  const raw = payload.slice(4)
  const [ivPart, cipherPart] = raw.split('.')
  if (!ivPart || !cipherPart) return null
  try {
    const key = await deriveAesKey()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      key,
      fromBase64(cipherPart),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

/** Stable numeric employeeNo suitable for Hikvision person records. */
export function employeeNoFromGuestId(guestId: string): string {
  const hex = guestId.replace(/-/g, '').slice(0, 12)
  const n = Number.parseInt(hex, 16)
  if (!Number.isFinite(n)) {
    return String(100_000_000 + Math.floor(Math.random() * 800_000_000))
  }
  return String((n % 800_000_000) + 100_000_000)
}

/** Staff employeeNo in a disjoint numeric band from guest IDs. */
export function employeeNoFromStaffKey(key: string): string {
  const hex = key.replace(/-/g, '').slice(0, 12)
  const n = Number.parseInt(hex, 16)
  if (!Number.isFinite(n)) {
    return String(900_000_000 + Math.floor(Math.random() * 99_000_000))
  }
  return String((n % 99_000_000) + 900_000_000)
}

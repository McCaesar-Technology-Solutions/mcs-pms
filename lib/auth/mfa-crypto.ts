/** Edge- and Node-compatible HMAC helpers (no `node:crypto`). */

import { getMfaOtpSecret } from '@/lib/env'

function mfaSecret(): string {
  return getMfaOtpSecret()
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return bufferToHex(sig)
}

export async function hashOtp(code: string): Promise<string> {
  return hmacSha256Hex(mfaSecret(), code.trim())
}

export async function hashSessionKey(refreshToken: string): Promise<string> {
  return hmacSha256Hex(mfaSecret(), refreshToken)
}

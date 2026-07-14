import { cookies } from 'next/headers'
import { getGuestSessionSecret } from '@/lib/env'

export const GUEST_RULES_ACK_COOKIE = 'guest_rules_ack'

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function signPayload(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getGuestSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return bufferToHex(sig)
}

/** Format: hotelId.version.expUnix.signature */
async function parseSignedAck(raw: string): Promise<{ hotelId: string; version: number } | null> {
  const parts = raw.split('.')
  if (parts.length !== 4) return null

  const [hotelId, versionStr, expStr, sig] = parts
  if (!hotelId || !versionStr || !expStr || !sig) return null

  const version = Number.parseInt(versionStr, 10)
  const exp = Number.parseInt(expStr, 10)
  if (!Number.isFinite(version) || !Number.isFinite(exp) || exp <= 0) return null

  if (exp * 1000 <= Date.now()) return null

  const payload = `${hotelId}.${versionStr}.${expStr}`
  const expected = await signPayload(payload)
  if (sig.length !== expected.length) return null

  let mismatch = 0
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return null

  return { hotelId, version }
}

export async function getPropertyRulesAck(): Promise<{ hotelId: string; version: number } | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(GUEST_RULES_ACK_COOKIE)?.value
  if (!raw) return null

  // Legacy unsigned format: hotelId:version (ignored — guests must re-accept)
  if (raw.includes(':') && !raw.includes('.')) return null

  return parseSignedAck(raw)
}

export async function hasAcceptedPropertyRules(
  hotelId: string,
  requiredVersion: number,
): Promise<boolean> {
  const ack = await getPropertyRulesAck()
  return ack?.hotelId === hotelId && ack.version >= requiredVersion
}

export async function setPropertyRulesAck(hotelId: string, version: number): Promise<void> {
  const exp = Math.floor((Date.now() + 60 * 60 * 24 * 1000) / 1000)
  const payload = `${hotelId}.${version}.${exp}`
  const sig = await signPayload(payload)
  const token = `${payload}.${sig}`

  const cookieStore = await cookies()
  cookieStore.set(GUEST_RULES_ACK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/guest',
    maxAge: 60 * 60 * 24,
  })
}

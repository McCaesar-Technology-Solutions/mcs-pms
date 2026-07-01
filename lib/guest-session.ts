import { cookies } from 'next/headers'
import { getGuestSessionSecret } from '@/lib/env'

export const GUEST_SESSION_COOKIE = 'guest_session'

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

/** Format: guestId.expUnix.signature */
export async function createGuestSessionToken(guestId: string, expiresAt: Date): Promise<string> {
  const exp = Math.floor(expiresAt.getTime() / 1000)
  const payload = `${guestId}.${exp}`
  const sig = await signPayload(payload)
  return `${payload}.${sig}`
}

export async function parseGuestSessionToken(
  token: string,
): Promise<{ guestId: string; expiresAt: Date } | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [guestId, expStr, sig] = parts
  if (!guestId || !expStr || !sig) return null

  const exp = Number.parseInt(expStr, 10)
  if (!Number.isFinite(exp) || exp <= 0) return null

  const payload = `${guestId}.${expStr}`
  const expected = await signPayload(payload)
  if (sig.length !== expected.length) return null

  // Constant-time compare
  let mismatch = 0
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return null

  const expiresAt = new Date(exp * 1000)
  if (expiresAt.getTime() <= Date.now()) return null

  return { guestId, expiresAt }
}

export async function getGuestSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(GUEST_SESSION_COOKIE)?.value
  if (!raw) return null

  const parsed = await parseGuestSessionToken(raw)
  return parsed?.guestId ?? null
}

export async function setGuestSession(guestId: string, expiresAt: Date) {
  const cookieStore = await cookies()
  cookieStore.set(GUEST_SESSION_COOKIE, await createGuestSessionToken(guestId, expiresAt), {
    ...guestSessionCookieOptions(expiresAt),
  })
}

/** Cookie attributes shared by server actions and route handlers. */
export function guestSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/guest',
    expires: expiresAt,
  }
}

export async function clearGuestSession() {
  const cookieStore = await cookies()
  cookieStore.delete({ name: GUEST_SESSION_COOKIE, path: '/guest' })
}

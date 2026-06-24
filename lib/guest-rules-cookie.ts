import { cookies } from 'next/headers'

export const GUEST_RULES_ACK_COOKIE = 'guest_rules_ack'

export async function getPropertyRulesAck(): Promise<{ hotelId: string; version: number } | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(GUEST_RULES_ACK_COOKIE)?.value
  if (!raw) return null

  const separator = raw.indexOf(':')
  if (separator <= 0) return null

  const hotelId = raw.slice(0, separator)
  const version = Number.parseInt(raw.slice(separator + 1), 10)
  if (!hotelId || !Number.isFinite(version)) return null

  return { hotelId, version }
}

export async function hasAcceptedPropertyRules(
  hotelId: string,
  requiredVersion: number,
): Promise<boolean> {
  const ack = await getPropertyRulesAck()
  return ack?.hotelId === hotelId && ack.version >= requiredVersion
}

export async function setPropertyRulesAck(hotelId: string, version: number): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(GUEST_RULES_ACK_COOKIE, `${hotelId}:${version}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/guest',
    maxAge: 60 * 60 * 24,
  })
}

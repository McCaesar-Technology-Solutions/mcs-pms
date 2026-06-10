import { cookies } from 'next/headers'

export const GUEST_SESSION_COOKIE = 'guest_session'

export async function getGuestSessionId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(GUEST_SESSION_COOKIE)?.value ?? null
}

export async function setGuestSession(guestId: string, expiresAt: Date) {
  const cookieStore = await cookies()
  cookieStore.set(GUEST_SESSION_COOKIE, guestId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/guest',
    expires: expiresAt,
  })
}

export async function clearGuestSession() {
  const cookieStore = await cookies()
  cookieStore.delete(GUEST_SESSION_COOKIE)
}

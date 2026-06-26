import { type NextRequest, NextResponse } from 'next/server'
import { validateGuestAccessToken } from '@/lib/guest/access-token'
import {
  createGuestSessionToken,
  GUEST_SESSION_COOKIE,
  guestSessionCookieOptions,
} from '@/lib/guest-session'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? request.nextUrl.searchParams.get('t')

  if (!token) {
    return NextResponse.redirect(new URL('/guest?error=missing', request.url))
  }

  try {
    const result = await validateGuestAccessToken(token)

    if (!result.ok) {
      return NextResponse.redirect(
        new URL(`/guest?error=${encodeURIComponent(result.error)}`, request.url),
      )
    }

    const sessionToken = await createGuestSessionToken(result.guest.id, result.expiresAt)
    const response = NextResponse.redirect(new URL('/guest', request.url))
    response.cookies.set(
      GUEST_SESSION_COOKIE,
      sessionToken,
      guestSessionCookieOptions(result.expiresAt),
    )
    return response
  } catch (err) {
    console.error('[guest/enter]', err)
    return NextResponse.redirect(new URL('/guest?error=config', request.url))
  }
}

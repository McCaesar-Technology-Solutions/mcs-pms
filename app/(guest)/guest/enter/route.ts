import { type NextRequest, NextResponse } from 'next/server'
import { getClientIpFromRequest } from '@/lib/auth/client-ip'
import { validateGuestAccessToken } from '@/lib/guest/access-token'
import {
  createGuestSessionToken,
  GUEST_SESSION_COOKIE,
  guestSessionCookieOptions,
} from '@/lib/guest-session'
import { assertRateLimit, GUEST_RATE_LIMITS, ipRateKey } from '@/lib/rate-limit'

const RATE_LIMIT_MESSAGE =
  'Too many sign-in attempts. Please wait a few minutes and try again.'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? request.nextUrl.searchParams.get('t')

  if (!token) {
    return NextResponse.redirect(new URL('/guest?error=missing', request.url))
  }

  const ip = getClientIpFromRequest(request)
  const ipLimit = await assertRateLimit(
    ipRateKey('guest-magic-link', ip),
    GUEST_RATE_LIMITS.magicLinkEnterIp,
    RATE_LIMIT_MESSAGE,
  )
  if (ipLimit) {
    return NextResponse.redirect(new URL('/guest?error=rate_limit', request.url))
  }

  const tokenLimit = await assertRateLimit(
    ipRateKey('guest-magic-link-token', `${ip}:${token.slice(0, 8)}`),
    GUEST_RATE_LIMITS.magicLinkEnter,
    RATE_LIMIT_MESSAGE,
  )
  if (tokenLimit) {
    return NextResponse.redirect(new URL('/guest?error=rate_limit', request.url))
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

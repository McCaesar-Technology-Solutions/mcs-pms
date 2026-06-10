import { type NextRequest, NextResponse } from 'next/server'
import { validateGuestToken } from '@/app/actions/guest'
import { GUEST_SESSION_COOKIE } from '@/lib/guest-session'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/guest?error=missing', request.url))
  }

  const result = await validateGuestToken(token)

  if (!result.success || !result.data) {
    const error = result.success ? 'invalid' : result.error
    return NextResponse.redirect(
      new URL(`/guest?error=${encodeURIComponent(error)}`, request.url),
    )
  }

  const response = NextResponse.redirect(new URL('/guest', request.url))
  response.cookies.set(GUEST_SESSION_COOKIE, result.data.guest.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/guest',
    expires: new Date(result.data.expiresAt),
  })

  return response
}

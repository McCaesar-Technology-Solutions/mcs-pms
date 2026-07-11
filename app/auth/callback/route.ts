import { NextResponse, type NextRequest } from 'next/server'
import { getClientIpFromRequest } from '@/lib/auth/client-ip'
import { createClient } from '@/lib/supabase/server'
import { safeRelativePath } from '@/lib/auth/safe-redirect'
import { assertRateLimit, AUTH_RATE_LIMITS, ipRateKey } from '@/lib/rate-limit'

/**
 * Exchanges the one-time code from a Supabase email link (password recovery,
 * email confirmation) for a session, then forwards to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const safeNext = safeRelativePath(next, '/', { blockAuthPaths: false })

  const ip = getClientIpFromRequest(request)
  const rateLimited = await assertRateLimit(
    ipRateKey('auth-callback', ip),
    AUTH_RATE_LIMITS.authCallback,
    'Too many attempts. Please wait and try again.',
  )
  if (rateLimited) {
    return NextResponse.redirect(`${origin}/login?error=rate_limit`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`)
}

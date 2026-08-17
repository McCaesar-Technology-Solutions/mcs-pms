import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { buildContentSecurityPolicy, cspHeaderName, getSecurityHeaders } from '@/lib/security/csp.mjs'

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildContentSecurityPolicy(nonce)
  const cspName = cspHeaderName()

  // Mutate in place — do NOT reconstruct a new NextRequest. updateSession reads
  // request.cookies and request.nextUrl across many branches; a rebuilt request
  // risks losing that state. Because this is the same object reference, every
  // internal NextResponse.next({ request }) call inside updateSession picks up
  // these headers automatically.
  request.headers.set('x-nonce', nonce)
  // Next.js stamps its own inline scripts from the *request* CSP header
  // (content-security-policy or content-security-policy-report-only), not from
  // x-nonce. Setting CSP only on the response leaves those scripts un-nonced.
  request.headers.set(cspName, csp)

  const response = await updateSession(request)

  response.headers.set(cspName, csp)
  for (const header of getSecurityHeaders()) {
    if (header.key === cspName) continue // already set above with the nonce
    response.headers.set(header.key, header.value)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

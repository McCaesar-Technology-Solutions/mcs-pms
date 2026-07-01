import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

function parseForwardedIp(forwarded: string | null): string | null {
  if (!forwarded) return null
  const first = forwarded.split(',')[0]?.trim()
  return first || null
}

/** Best-effort client IP for rate limiting (Vercel / reverse proxy aware). */
export async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    parseForwardedIp(h.get('x-forwarded-for')) ??
    h.get('x-real-ip')?.trim() ??
    'unknown'
  )
}

/** Route handlers — read IP from the incoming request without `headers()`. */
export function getClientIpFromRequest(request: NextRequest): string {
  return (
    parseForwardedIp(request.headers.get('x-forwarded-for')) ??
    request.headers.get('x-real-ip')?.trim() ??
    'unknown'
  )
}

/**
 * Content-Security-Policy builder for Next.js response headers.
 * Report-only mode: set CSP_REPORT_ONLY=true (staging / first rollout).
 */

function supabaseConnectSources() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!raw) {
    return 'https://*.supabase.co wss://*.supabase.co'
  }
  try {
    const host = new URL(raw).host
    return `https://${host} wss://${host} https://*.supabase.co wss://*.supabase.co`
  } catch {
    return 'https://*.supabase.co wss://*.supabase.co'
  }
}

export function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Next.js + Vercel Analytics (inline scripts required without nonce pipeline)
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseConnectSources()} https://vitals.vercel-insights.com`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ]

  const reportUri = process.env.CSP_REPORT_URI?.trim()
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`)
  }

  return directives.join('; ')
}

export function cspHeaderName() {
  return process.env.CSP_REPORT_ONLY === 'true'
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy'
}

export function getSecurityHeaders() {
  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    { key: cspHeaderName(), value: buildContentSecurityPolicy() },
  ]
}

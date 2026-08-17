import { withSentryConfig } from '@sentry/nextjs'
import { getSecurityHeaders } from './lib/security/csp.mjs'

function supabaseImageRemotePattern() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  if (!raw) return null
  try {
    const { hostname, protocol } = new URL(raw)
    if (protocol !== 'https:') return null
    return {
      protocol: 'https',
      hostname,
      pathname: '/storage/v1/object/public/**',
    }
  } catch {
    return null
  }
}

const supabaseRemote = supabaseImageRemotePattern()

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    ...(supabaseRemote ? { remotePatterns: [supabaseRemote] } : {}),
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        // CSP is set per-request in middleware.ts (nonce-based). Static headers only here.
        headers: getSecurityHeaders(),
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: '/monitoring',
  widenClientFileUpload: true,
})

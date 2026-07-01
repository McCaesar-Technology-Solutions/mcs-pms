import { getSecurityHeaders } from './lib/security/csp.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // P3: keep unoptimized for direct Supabase public URLs; revisit when tuning LCP.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getSecurityHeaders(),
      },
    ]
  },
}

export default nextConfig

import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, cspHeaderName, getSecurityHeaders } from '../lib/security/csp.mjs'

describe('content security policy', () => {
  it('builds a restrictive default policy', () => {
    const policy = buildContentSecurityPolicy()
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain('upgrade-insecure-requests')
  })

  it('includes Supabase hosts when configured', () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co'
    const policy = buildContentSecurityPolicy()
    expect(policy).toContain('abcxyz.supabase.co')
    process.env.NEXT_PUBLIC_SUPABASE_URL = prev
  })

  it('uses report-only header when CSP_REPORT_ONLY is set', () => {
    const prev = process.env.CSP_REPORT_ONLY
    process.env.CSP_REPORT_ONLY = 'true'
    expect(cspHeaderName()).toBe('Content-Security-Policy-Report-Only')
    process.env.CSP_REPORT_ONLY = prev
  })

  it('returns security headers bundle with CSP', () => {
    const names = getSecurityHeaders().map((h) => h.key.toLowerCase())
    expect(names).toContain('content-security-policy')
    expect(names).toContain('strict-transport-security')
  })
})

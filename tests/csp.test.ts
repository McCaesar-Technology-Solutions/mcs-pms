import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, cspHeaderName, getSecurityHeaders } from '../lib/security/csp.mjs'

const TEST_NONCE = 'test-nonce-abc123'

function scriptSrcDirective(policy: string) {
  return policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('script-src'))
}

describe('content security policy', () => {
  it('builds a restrictive default policy', () => {
    const policy = buildContentSecurityPolicy(TEST_NONCE)
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain('upgrade-insecure-requests')
  })

  it('includes Supabase hosts when configured', () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcxyz.supabase.co'
    const policy = buildContentSecurityPolicy(TEST_NONCE)
    expect(policy).toContain('abcxyz.supabase.co')
    process.env.NEXT_PUBLIC_SUPABASE_URL = prev
  })

  it('uses report-only header when CSP_REPORT_ONLY is set', () => {
    const prev = process.env.CSP_REPORT_ONLY
    process.env.CSP_REPORT_ONLY = 'true'
    expect(cspHeaderName()).toBe('Content-Security-Policy-Report-Only')
    process.env.CSP_REPORT_ONLY = prev
  })

  it('uses nonce + strict-dynamic in production script-src, not unsafe-inline', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const scriptSrc = scriptSrcDirective(buildContentSecurityPolicy(TEST_NONCE))
    expect(scriptSrc).toContain(`'nonce-${TEST_NONCE}'`)
    expect(scriptSrc).toContain("'strict-dynamic'")
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain("'unsafe-eval'")
    process.env.NODE_ENV = prev
  })

  it('allows unsafe-eval and unsafe-inline only outside production', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    expect(scriptSrcDirective(buildContentSecurityPolicy(TEST_NONCE))).not.toContain("'unsafe-eval'")
    process.env.NODE_ENV = 'development'
    const devScriptSrc = scriptSrcDirective(buildContentSecurityPolicy(TEST_NONCE))
    expect(devScriptSrc).toContain("'unsafe-eval'")
    expect(devScriptSrc).toContain("'unsafe-inline'")
    process.env.NODE_ENV = prev
  })

  it('leaves style-src unsafe-inline unchanged', () => {
    expect(buildContentSecurityPolicy(TEST_NONCE)).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('returns static security headers without CSP (CSP is set per-request in middleware)', () => {
    const names = getSecurityHeaders().map((h) => h.key.toLowerCase())
    expect(names).not.toContain('content-security-policy')
    expect(names).not.toContain('content-security-policy-report-only')
    expect(names).toContain('strict-transport-security')
    expect(names).toContain('x-frame-options')
  })
})

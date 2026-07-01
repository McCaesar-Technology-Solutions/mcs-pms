import { test, expect } from '@playwright/test'

test.describe('security headers', () => {
  test('login response includes CSP and HSTS', async ({ request }) => {
    const res = await request.get('/login')
    expect(res.ok()).toBeTruthy()

    const headers = res.headers()
    const csp =
      headers['content-security-policy'] ?? headers['content-security-policy-report-only']
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain('frame-ancestors')

    expect(headers['strict-transport-security']).toContain('max-age')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
  })
})

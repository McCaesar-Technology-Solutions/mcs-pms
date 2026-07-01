import { describe, expect, it } from 'vitest'
import { safeRelativePath } from '@/lib/auth/safe-redirect'

describe('safeRelativePath', () => {
  it('allows same-origin paths', () => {
    expect(safeRelativePath('/reset-password', '/')).toBe('/reset-password')
    expect(safeRelativePath('/owner/dashboard?tab=1', '/')).toBe('/owner/dashboard?tab=1')
  })

  it('blocks protocol-relative open redirects', () => {
    expect(safeRelativePath('//evil.com', '/')).toBe('/')
    expect(safeRelativePath('//evil.com/path', '/home')).toBe('/home')
  })

  it('blocks absolute and off-site targets', () => {
    expect(safeRelativePath('https://evil.com', '/')).toBe('/')
    expect(safeRelativePath('evil.com', '/')).toBe('/')
  })

  it('blocks auth-loop paths by default', () => {
    expect(safeRelativePath('/login', '/owner/dashboard')).toBe('/owner/dashboard')
    expect(safeRelativePath('/verify-mfa', '/owner/dashboard')).toBe('/owner/dashboard')
  })

  it('can allow auth paths for email callback redirects', () => {
    expect(safeRelativePath('/reset-password', '/', { blockAuthPaths: false })).toBe('/reset-password')
    expect(safeRelativePath('//evil.com', '/', { blockAuthPaths: false })).toBe('/')
  })
})

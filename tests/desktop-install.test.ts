import { describe, expect, it } from 'vitest'
import { isMobileUserAgent, isSafariDesktop, detectDesktopBrowser, manualInstallSteps } from '@/lib/pwa/desktop-install'

describe('isSafariDesktop', () => {
  it('detects Safari on Mac', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
    expect(isSafariDesktop(ua)).toBe(true)
  })

  it('excludes Chrome on Mac', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(isSafariDesktop(ua)).toBe(false)
  })

  it('excludes iPhone Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(isSafariDesktop(ua)).toBe(false)
  })
})

describe('isMobileUserAgent', () => {
  const desktopChrome =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

  it('flags phone user agents', () => {
    expect(isMobileUserAgent(iphone)).toBe(true)
  })

  it('allows desktop user agents', () => {
    expect(isMobileUserAgent(desktopChrome)).toBe(false)
  })
})

describe('detectDesktopBrowser', () => {
  it('detects Chrome on Mac', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    expect(detectDesktopBrowser(ua)).toBe('chrome')
  })

  it('detects Edge', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(detectDesktopBrowser(ua)).toBe('edge')
  })

  it('returns manual steps for Chrome', () => {
    expect(manualInstallSteps('chrome').length).toBeGreaterThan(0)
    expect(manualInstallSteps('chrome').join(' ')).toMatch(/menu/i)
  })
})

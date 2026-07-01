/** Desktop-only PWA install helpers (login screen hint). */

export const PWA_INSTALL_DISMISS_KEY = 'mojo-pwa-install-dismissed'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const MOBILE_UA =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i

export function isMobileUserAgent(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  return MOBILE_UA.test(ua)
}

/** Laptop/desktop — excludes phones and tablets (login install hint only). */
export function isDesktopEnvironment(userAgent?: string): boolean {
  if (typeof window === 'undefined') return false
  const ua = userAgent ?? navigator.userAgent
  if (isMobileUserAgent(ua)) return false
  return window.matchMedia('(min-width: 1024px)').matches
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function isInstallHintDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(PWA_INSTALL_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissInstallHint(): void {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, '1')
  } catch {
    // Private browsing — ignore
  }
}

export function isSafariDesktop(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!ua) return false
  return /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)
}

export function shouldShowDesktopInstallHint(): boolean {
  return isDesktopEnvironment() && !isStandaloneApp() && !isInstallHintDismissed()
}

export type DesktopBrowser = 'chrome' | 'edge' | 'safari' | 'firefox' | 'other'

export function detectDesktopBrowser(userAgent?: string): DesktopBrowser {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!ua) return 'other'
  if (/Edg\//.test(ua)) return 'edge'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return 'safari'
  if (/Chrome\//.test(ua)) return 'chrome'
  return 'other'
}

/** When the browser does not fire beforeinstallprompt (common on first visit). */
export function manualInstallSteps(browser: DesktopBrowser): string[] {
  switch (browser) {
    case 'chrome':
      return [
        'Use Chrome in a normal window (not Incognito).',
        'Open the ⋮ menu (top-right) → Cast, save, and share → Install page as app.',
        'Some Chrome versions show a monitor ⊕ icon at the right end of the address bar instead.',
        'If nothing appears, sign in once and revisit — Chrome often enables install after you use the site.',
      ]
    case 'edge':
      return [
        'Open the ⋮ menu (top-right) → Apps → Install this site as an app.',
        'Or use the app icon at the right end of the address bar if you see it.',
        'Sign in once and revisit if install is not listed yet.',
      ]
    case 'safari':
      return ['Choose File → Add to Dock to open MOJO in its own window.']
    case 'firefox':
      return [
        'Firefox does not support install-from-address-bar like Chrome.',
        'Use Chrome or Edge on desktop, or bookmark this page for quick access.',
      ]
    default:
      return [
        'Use Chrome or Edge on desktop for the best install experience.',
        'Look in the browser menu for Install app or Install this site.',
      ]
  }
}

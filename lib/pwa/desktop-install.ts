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

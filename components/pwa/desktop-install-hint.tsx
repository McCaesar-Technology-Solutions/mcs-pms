'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import {
  dismissInstallHint,
  isSafariDesktop,
  shouldShowDesktopInstallHint,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa/desktop-install'

export function DesktopInstallHint() {
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (!shouldShowDesktopInstallHint()) return

    setVisible(true)

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setVisible(false)
      }
    } finally {
      setDeferredPrompt(null)
      setInstalling(false)
    }
  }

  function handleDismiss() {
    dismissInstallHint()
    setVisible(false)
  }

  if (!visible) return null

  const canInstall = !!deferredPrompt
  const safariDesktop = isSafariDesktop() && !deferredPrompt

  return (
    <div
      role="region"
      aria-label="Install app"
      className="mb-5 flex gap-3 rounded-lg border border-[var(--brand-gold)]/30 bg-[var(--brand-gold)]/10 px-3 py-2.5 text-sm text-white/90"
    >
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-gold)]" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        {canInstall ? (
          <>
            <div>
              <p className="font-medium text-white">Install on your computer</p>
              <p className="mt-0.5 text-xs text-white/65">
                Open MOJO in its own window — like an app, without browser tabs.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className="rounded-md bg-[var(--brand-gold)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-purple-ink)] transition hover:brightness-105 disabled:opacity-60"
            >
              {installing ? 'Installing…' : 'Install app'}
            </button>
          </>
        ) : safariDesktop ? (
          <div>
            <p className="font-medium text-white">Add to Dock</p>
            <p className="mt-0.5 text-xs text-white/65">
              In Safari, choose <span className="font-semibold text-white/80">File → Add to Dock</span>{' '}
              to open MOJO in its own window.
            </p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-white">Install on your computer</p>
            <p className="mt-0.5 text-xs text-white/65">
              Click the install icon in your browser&apos;s address bar to add MOJO to your desktop.
            </p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded p-1 text-white/50 transition hover:bg-white/10 hover:text-white/80"
        aria-label="Dismiss install hint"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

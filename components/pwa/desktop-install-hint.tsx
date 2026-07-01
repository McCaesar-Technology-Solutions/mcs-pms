'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import {
  detectDesktopBrowser,
  dismissInstallHint,
  manualInstallSteps,
  shouldShowDesktopInstallHint,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa/desktop-install'

type PromptState = 'waiting' | 'ready' | 'manual'

const PROMPT_WAIT_MS = 3000

export function DesktopInstallHint() {
  const [visible, setVisible] = useState(false)
  const [promptState, setPromptState] = useState<PromptState>('waiting')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const browser = detectDesktopBrowser()

  useEffect(() => {
    if (!shouldShowDesktopInstallHint()) return

    setVisible(true)

    let promptReceived = false

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      promptReceived = true
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setPromptState('ready')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)

    const timer = window.setTimeout(() => {
      if (!promptReceived) setPromptState('manual')
    }, PROMPT_WAIT_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.clearTimeout(timer)
    }
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

  const steps = manualInstallSteps(browser)
  const canInstall = promptState === 'ready' && !!deferredPrompt

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
        ) : promptState === 'waiting' ? (
          <div>
            <p className="font-medium text-white">Install on your computer</p>
            <p className="mt-0.5 text-xs text-white/65">Checking install options…</p>
          </div>
        ) : (
          <div>
            <p className="font-medium text-white">Install on your computer</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-white/65">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
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

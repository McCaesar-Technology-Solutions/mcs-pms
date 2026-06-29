'use client'

import { useEffect, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import type { Profile } from '@/types'

interface WayfindingTipProps {
  id: string
  role: Profile['role']
  title: string
  children: React.ReactNode
}

function storageKey(role: string, id: string) {
  return `mojo-wayfinding-${role}-${id}`
}

/** One-time dismissible tip shown on dashboards until the user closes it. */
export function WayfindingTip({ id, role, title, children }: WayfindingTipProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(storageKey(role, id)) !== '1')
    } catch {
      setVisible(true)
    }
  }, [id, role])

  if (!visible) return null

  function dismiss() {
    try {
      localStorage.setItem(storageKey(role, id), '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div className="wayfinding-tip surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-purple)]/10 text-[var(--brand-purple)]">
          <Lightbulb className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss tip"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

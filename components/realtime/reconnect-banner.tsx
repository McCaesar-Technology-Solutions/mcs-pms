'use client'

import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RealtimeReconnectBannerProps {
  onReconnect: () => void
  /** Raise above guest portal bottom navigation. */
  offset?: 'default' | 'guest-nav'
}

export function RealtimeReconnectBanner({
  onReconnect,
  offset = 'default',
}: RealtimeReconnectBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed left-1/2 z-[var(--z-reconnect)] -translate-x-1/2',
        offset === 'guest-nav'
          ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
          : 'bottom-4',
      )}
    >
      <button
        type="button"
        onClick={onReconnect}
        className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition hover:bg-primary/90"
      >
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        Live updates paused — tap to reconnect
      </button>
    </div>
  )
}

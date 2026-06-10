'use client'

interface RealtimeReconnectBannerProps {
  onReconnect: () => void
}

export function RealtimeReconnectBanner({ onReconnect }: RealtimeReconnectBannerProps) {
  return (
    <button
      type="button"
      onClick={onReconnect}
      className="fixed bottom-4 left-1/2 z-[10000] -translate-x-1/2 rounded-full bg-[#3C216C] px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      Live updates paused — tap to reconnect
    </button>
  )
}

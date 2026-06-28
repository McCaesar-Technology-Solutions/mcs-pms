'use client'

import { ArrowRight, Phone } from 'lucide-react'
import type { TechnicianNextAction } from '@/lib/complaints/technician-progress'

interface TechnicianNextStepBannerProps {
  action: TechnicianNextAction
  onAction: () => void
  loading?: boolean
  compact?: boolean
}

export function TechnicianNextStepBanner({
  action,
  onAction,
  loading = false,
  compact = false,
}: TechnicianNextStepBannerProps) {
  if (action.actionKind === 'none' || action.type === 'resolved') {
    return (
      <div className={`technician-notice-card ${compact ? '!p-3' : ''}`}>
        <p className="technician-eyebrow">Status</p>
        <p className="mt-1 text-sm font-semibold">{action.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[var(--tech-fg-muted)]">{action.detail}</p>
      </div>
    )
  }

  return (
    <div className={`technician-notice-card ${compact ? '!p-3' : ''}`}>
      <p className="technician-eyebrow">Next step</p>
      <p className="mt-1 text-sm font-semibold">{action.title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-[var(--tech-fg-muted)]">{action.detail}</p>
      {action.actionLabel && (
        <button
          type="button"
          onClick={onAction}
          disabled={loading}
          className={`technician-btn technician-btn--primary mt-3 flex w-full items-center justify-center gap-2 ${
            compact ? 'py-2.5 text-sm' : 'py-3 text-sm'
          }`}
        >
          {action.actionKind === 'call' && <Phone className="h-4 w-4" />}
          {loading ? 'Working…' : action.actionLabel}
          {action.actionKind !== 'call' && <ArrowRight className="h-4 w-4" />}
        </button>
      )}
    </div>
  )
}

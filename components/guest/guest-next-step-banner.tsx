'use client'

import { ArrowRight, CalendarClock, CheckCircle2, Wrench } from 'lucide-react'
import type { GuestNextAction } from '@/lib/complaints/guest-next-action'

interface GuestNextStepBannerProps {
  action: GuestNextAction
  onAction: (action: GuestNextAction) => void
  variant?: 'home' | 'inline'
}

const iconForType: Record<GuestNextAction['type'], typeof Wrench> = {
  confirm_complete: CheckCircle2,
  visit_scheduled: CalendarClock,
  awaiting_visit: CalendarClock,
  being_handled: Wrench,
  being_reviewed: Wrench,
}

export function GuestNextStepBanner({
  action,
  onAction,
  variant = 'home',
}: GuestNextStepBannerProps) {
  const Icon = iconForType[action.type]
  const isHome = variant === 'home'
  const isConfirm = action.type === 'confirm_complete'

  return (
    <div
      className={`guest-portal-card ${
        isConfirm ? 'border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/8' : ''
      } ${isHome ? '' : '!p-3.5'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-lg bg-[var(--guest-accent-soft)] text-[var(--brand-purple)] ${
            isHome ? 'h-10 w-10' : 'h-9 w-9'
          } ${isConfirm ? 'bg-[var(--brand-orange)]/15 text-[var(--brand-orange)]' : ''}`}
        >
          <Icon className={isHome ? 'h-5 w-5' : 'h-4 w-4'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide guest-text-subtle">
            Next step · {action.reference}
          </p>
          <p className={`mt-0.5 font-semibold ${isHome ? 'text-base' : 'text-sm'}`}>
            {action.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed guest-text-muted">{action.detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAction(action)}
        className={`guest-btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white ${
          isConfirm ? 'guest-btn-accent py-3' : 'guest-btn-primary py-2.5'
        }`}
      >
        {action.actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

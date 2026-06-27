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
      className={`overflow-hidden rounded-2xl border ${
        isConfirm
          ? 'border-[var(--brand-orange)]/35 bg-gradient-to-br from-[var(--brand-orange)]/20 to-[var(--brand-purple)]/35'
          : 'border-white/14 bg-gradient-to-br from-white/10 to-[var(--brand-purple)]/30'
      } ${isHome ? 'p-5' : 'p-3.5'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl ${
            isConfirm
              ? 'bg-[var(--brand-orange)]/25 text-[var(--brand-orange-light)]'
              : 'bg-white/12 text-white'
          } ${isHome ? 'h-11 w-11' : 'h-9 w-9'}`}
        >
          <Icon className={isHome ? 'h-5 w-5' : 'h-4 w-4'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label-eyebrow text-white/55">
            Next step · {action.reference}
          </p>
          <p className={`mt-0.5 font-semibold text-white ${isHome ? 'text-base' : 'text-sm'}`}>
            {action.title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{action.detail}</p>
          <p className="mt-1 text-xs capitalize text-white/50">{action.category}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAction(action)}
        className={`guest-btn mt-4 flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white ${
          isConfirm
            ? 'guest-btn-accent py-3.5'
            : 'guest-btn-primary py-3'
        } ${isHome ? 'text-sm' : 'py-2.5 text-sm'}`}
      >
        {action.actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

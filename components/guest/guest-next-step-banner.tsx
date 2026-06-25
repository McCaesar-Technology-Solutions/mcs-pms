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

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${
        action.type === 'confirm_complete'
          ? 'border-[#D85A30]/40 bg-gradient-to-br from-[#D85A30]/20 to-[#3C216C]/30'
          : 'border-[#D4A62E]/30 bg-gradient-to-br from-[#D4A62E]/15 to-[#3C216C]/25'
      } ${isHome ? 'p-5' : 'p-3.5'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl ${
            action.type === 'confirm_complete'
              ? 'bg-[#D85A30]/25 text-[#ffb899]'
              : 'bg-[#D4A62E]/20 text-[#D4A62E]'
          } ${isHome ? 'h-11 w-11' : 'h-9 w-9'}`}
        >
          <Icon className={isHome ? 'h-5 w-5' : 'h-4 w-4'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4A62E]">
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
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition ${
          action.type === 'confirm_complete'
            ? 'bg-[#D85A30] py-3.5 hover:bg-[#c24e28]'
            : 'bg-[#3C216C] py-3 hover:bg-[#4c2a85]'
        } ${isHome ? 'text-sm' : 'py-2.5 text-sm'}`}
      >
        {action.actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

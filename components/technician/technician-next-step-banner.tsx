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
      <div
        className={`rounded-xl border-l-4 border-[#3C216C] bg-white shadow-elevation-1 ${
          compact ? 'p-3' : 'p-3.5'
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#3C216C]">Status</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{action.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border-l-4 border-[#3C216C] bg-white shadow-elevation-1 ${
        compact ? 'p-3' : 'p-3.5'
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#3C216C]">Next step</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{action.title}</p>
      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
      {action.actionLabel && (
        <button
          type="button"
          onClick={onAction}
          disabled={loading}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3C216C] font-semibold text-white shadow-elevation-1 transition hover:bg-[#4c2a85] disabled:opacity-60 ${
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

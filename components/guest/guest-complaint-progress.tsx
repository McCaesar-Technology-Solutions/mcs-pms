'use client'

import { Check, Circle, Loader2 } from 'lucide-react'
import { buildGuestRepairSteps } from '@/lib/complaints/guest-progress'
import type { Complaint } from '@/types'

interface GuestComplaintProgressProps {
  complaint: Complaint
}

export function GuestComplaintProgress({ complaint }: GuestComplaintProgressProps) {
  const steps = buildGuestRepairSteps(complaint)

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
        Repair progress
      </p>
      <ol className="mt-3 space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1
          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    step.state === 'complete'
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : step.state === 'current'
                        ? 'bg-[#D4A62E]/25 text-[#D4A62E]'
                        : 'bg-white/10 text-white/30'
                  }`}
                >
                  {step.state === 'complete' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : step.state === 'current' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Circle className="h-2 w-2 fill-current" />
                  )}
                </span>
                {!isLast && (
                  <span
                    className={`my-0.5 w-px flex-1 min-h-4 ${
                      step.state === 'complete' ? 'bg-emerald-500/30' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
              <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                <p
                  className={`text-sm font-medium ${
                    step.state === 'upcoming' ? 'text-white/45' : 'text-white/90'
                  }`}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p
                    className={`mt-0.5 text-xs leading-relaxed ${
                      step.state === 'current' ? 'text-[#D4A62E]/90' : 'text-white/55'
                    }`}
                  >
                    {step.detail}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

'use client'

import { Check, Circle, Loader2 } from 'lucide-react'
import { buildTechnicianJobSteps } from '@/lib/complaints/technician-progress'
import type { Complaint } from '@/types'

interface TechnicianJobProgressProps {
  complaint: Complaint
}

export function TechnicianJobProgress({ complaint }: TechnicianJobProgressProps) {
  const steps = buildTechnicianJobSteps(complaint)

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Job progress
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
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : step.state === 'current'
                        ? 'bg-[#3C216C]/12 text-[#3C216C]'
                        : 'bg-muted text-muted-foreground/40'
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
                    className={`my-0.5 min-h-4 w-px flex-1 ${
                      step.state === 'complete' ? 'bg-emerald-500/25' : 'bg-border'
                    }`}
                  />
                )}
              </div>
              <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                <p
                  className={`text-sm font-medium ${
                    step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p
                    className={`mt-0.5 text-xs leading-relaxed ${
                      step.state === 'current' ? 'text-[#3C216C]' : 'text-muted-foreground'
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

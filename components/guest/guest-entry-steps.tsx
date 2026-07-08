import { Check } from 'lucide-react'

interface GuestEntryStepsProps {
  current: 1 | 2 | 3
}

const STEPS = [
  { step: 1 as const, label: 'House rules' },
  { step: 2 as const, label: 'Room & PIN' },
  { step: 3 as const, label: 'Portal' },
]

export function GuestEntrySteps({ current }: GuestEntryStepsProps) {
  return (
    <nav aria-label="Guest sign-in progress" className="guest-entry-steps">
      <ol className="flex items-center justify-center gap-2 sm:gap-3">
        {STEPS.map(({ step, label }) => {
          const done = step < current
          const active = step === current
          return (
            <li key={step} className="flex items-center gap-2 sm:gap-3">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`guest-entry-steps__dot ${
                    active
                      ? 'guest-entry-steps__dot--active'
                      : done
                        ? 'guest-entry-steps__dot--done'
                        : ''
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : step}
                </span>
                <span
                  className={`guest-entry-steps__label ${
                    active ? 'guest-entry-steps__label--active' : ''
                  }`}
                >
                  {label}
                </span>
              </div>
              {step < 3 && (
                <span
                  className={`guest-entry-steps__line ${done ? 'guest-entry-steps__line--done' : ''}`}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

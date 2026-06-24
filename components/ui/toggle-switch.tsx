'use client'

import { cn } from '@/lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  showLabel?: boolean
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  showLabel = true,
}: ToggleSwitchProps) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      {showLabel && (
        <span
          className={cn(
            'min-w-[2rem] text-right text-xs font-bold uppercase tracking-wide',
            disabled && 'opacity-60',
            checked ? 'text-[#3C216C]' : 'text-[#6B6578]',
          )}
          aria-hidden
        >
          {checked ? 'On' : 'Off'}
        </span>
      )}
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full border-2 p-0.5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3C216C]/35 focus-visible:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          checked
            ? 'border-[#3C216C] bg-[#3C216C]'
            : 'border-[#8E89A0] bg-[#D4D0DC]',
        )}
      >
        <span
          className={cn(
            'block h-6 w-6 rounded-full bg-white shadow-[0_1px_4px_rgba(34,18,76,0.28)] ring-1 ring-black/5 transition-transform duration-200',
            checked ? 'translate-x-6' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  )
}

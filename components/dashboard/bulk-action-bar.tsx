'use client'

import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'

export interface BulkAction {
  key: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  hidden?: boolean
}

interface BulkActionBarProps {
  count: number
  actions: BulkAction[]
  onClear: () => void
  ariaLabel?: string
}

export function BulkActionBar({
  count,
  actions,
  onClear,
  ariaLabel = 'Bulk actions',
}: BulkActionBarProps) {
  if (count === 0) return null

  const visible = actions.filter((action) => !action.hidden)

  return (
    <div className="reservations-bulk-bar" role="toolbar" aria-label={ariaLabel}>
      <div className="reservations-bulk-bar__inner">
        <p className="reservations-bulk-bar__count">
          <span className="font-semibold text-foreground">{count}</span> selected
        </p>

        <div className="reservations-bulk-bar__actions">
          {visible.map(({ key, label, icon: Icon, onClick, variant, disabled }) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={onClick}
              className={`reservations-bulk-bar__btn${
                variant === 'danger' ? ' reservations-bulk-bar__btn--danger' : ''
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClear}
          className="reservations-bulk-bar__close"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

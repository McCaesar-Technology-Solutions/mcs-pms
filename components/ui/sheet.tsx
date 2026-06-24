'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { modalOverlayClass, sheetPanelClass } from '@/components/ui/centered-modal'

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  side?: 'right' | 'left'
  'aria-label'?: string
}

export function Sheet({
  open,
  onOpenChange,
  children,
  side = 'right',
  'aria-label': ariaLabel = 'Panel',
}: SheetProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-sheet)]"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Close panel"
        className={modalOverlayClass}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          sheetPanelClass,
          'absolute top-0',
          side === 'right' ? 'right-0' : 'left-0',
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function SheetHeader({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode
  className?: string
  onClose?: () => void
}) {
  return (
    <div
      className={cn(
        'surface-card-header flex shrink-0 items-start justify-between gap-3 px-6 py-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="modal-panel-subtle shrink-0 rounded-lg p-2 transition-colors hover:bg-[#E9ECEF]"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground">{children}</h2>
}

export function SheetContent({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex-1 overflow-y-auto overscroll-contain px-5 py-5', className)}>
      {children}
    </div>
  )
}

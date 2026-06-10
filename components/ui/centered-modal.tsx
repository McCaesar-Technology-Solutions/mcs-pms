'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const modalOverlayClass =
  'absolute inset-0 bg-[#22124C]/60 backdrop-blur-[3px] transition-opacity'

export const modalPanelClass =
  'modal-panel surface-card relative z-10 flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-elevation-4'

export const sheetPanelClass =
  'relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden bg-[#F7F5FB] shadow-[-12px_0_48px_rgba(34,18,76,0.14)]'

interface CenteredModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  panelClassName?: string
  'aria-label'?: string
}

export function CenteredModal({
  open,
  onClose,
  children,
  className = 'max-w-md',
  panelClassName,
  'aria-label': ariaLabel = 'Dialog',
}: CenteredModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className={modalOverlayClass}
        onClick={onClose}
      />
      <div
        className={cn(modalPanelClass, className, panelClassName)}
        style={{ maxHeight: 'min(90dvh, calc(100dvh - 2rem))' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({
  children,
  onClose,
  className,
}: {
  children: React.ReactNode
  onClose?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-start justify-between gap-3 bg-[#FAFDFF] px-6 py-4 shadow-elevation-1',
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

export function ModalBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex-1 overflow-y-auto overscroll-contain px-6 py-5', className)}>
      {children}
    </div>
  )
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'shrink-0 bg-[#FAFDFF] px-6 py-4 shadow-[0_-4px_24px_rgba(34,18,76,0.06)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

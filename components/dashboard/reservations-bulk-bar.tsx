'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { cancelReservation } from '@/app/actions/reservations'
import { canCancelReservationStatus } from '@/lib/reservations/lifecycle'
import { Copy, Download, Trash2, X } from 'lucide-react'
import type { Reservation } from '@/types'

interface ReservationsBulkBarProps {
  selected: Reservation[]
  onClear: () => void
  onMutated: () => void
}

import { downloadCsv } from '@/lib/export/download-csv'

export function ReservationsBulkBar({ selected, onClear, onMutated }: ReservationsBulkBarProps) {
  const [pending, startTransition] = useTransition()

  if (selected.length === 0) return null

  const cancellable = selected.filter((r) => canCancelReservationStatus(r.status))

  function copyRefs() {
    const text = selected.map((r) => r.bookingRef).join(', ')
    void navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copied ${selected.length} booking ref${selected.length === 1 ? '' : 's'}`)
    })
  }

  function exportCsv() {
    const header = ['Reference', 'Guest', 'Room', 'Check-in', 'Check-out', 'Status', 'Amount']
    const rows = selected.map((r) => [
      r.bookingRef,
      r.guestName,
      r.roomNumber,
      r.checkInDate,
      r.checkOutDate,
      r.status,
      String(r.totalPrice),
    ])
    downloadCsv(`reservations-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selected.length} reservation${selected.length === 1 ? '' : 's'}`)
  }

  function bulkCancel() {
    if (cancellable.length === 0) {
      toast.error('No selected reservations can be cancelled in bulk.')
      return
    }
    const label =
      cancellable.length === 1
        ? `cancel ${cancellable[0].bookingRef}?`
        : `cancel ${cancellable.length} confirmed reservations?`
    if (!window.confirm(`Are you sure you want to ${label}`)) return

    startTransition(async () => {
      let ok = 0
      let failed = 0
      for (const res of cancellable) {
        const result = await cancelReservation(res.id)
        if (result.success) ok += 1
        else failed += 1
      }
      if (ok > 0) {
        toast.success(`Cancelled ${ok} reservation${ok === 1 ? '' : 's'}`)
        onMutated()
      }
      if (failed > 0) {
        toast.error(`${failed} could not be cancelled (deposit or status rules).`)
      }
      onClear()
    })
  }

  return (
    <div className="reservations-bulk-bar" role="toolbar" aria-label="Bulk reservation actions">
      <div className="reservations-bulk-bar__inner">
        <p className="reservations-bulk-bar__count">
          <span className="font-semibold text-foreground">{selected.length}</span> selected
        </p>

        <div className="reservations-bulk-bar__actions">
          <button type="button" onClick={copyRefs} className="reservations-bulk-bar__btn">
            <Copy className="h-4 w-4" />
            Copy refs
          </button>
          <button type="button" onClick={exportCsv} className="reservations-bulk-bar__btn">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {cancellable.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={bulkCancel}
              className="reservations-bulk-bar__btn reservations-bulk-bar__btn--danger"
            >
              <Trash2 className="h-4 w-4" />
              {pending ? 'Cancelling…' : `Cancel (${cancellable.length})`}
            </button>
          )}
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

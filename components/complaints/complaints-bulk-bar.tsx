'use client'

import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { downloadCsv } from '@/lib/export/download-csv'
import { complaintRef, copyToClipboard } from '@/lib/export/entity-refs'
import type { Complaint } from '@/types'

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface ComplaintsBulkBarProps {
  selected: Complaint[]
  onClear: () => void
  roomNumberOf: (c: Complaint) => string | null
  guestNameOf: (c: Complaint) => string | null
}

export function ComplaintsBulkBar({
  selected,
  onClear,
  roomNumberOf,
  guestNameOf,
}: ComplaintsBulkBarProps) {
  if (selected.length === 0) return null

  function copyRefs() {
    void copyToClipboard(
      selected.map((c) => complaintRef(c.id)).join(', '),
      `Copied ${selected.length} ticket ref${selected.length === 1 ? '' : 's'}`,
    )
  }

  function exportCsv() {
    const header = ['Reference', 'Category', 'Room', 'Guest', 'Status', 'Priority', 'Description', 'Submitted']
    const rows = selected.map((c) => [
      complaintRef(c.id),
      formatLabel(c.category),
      roomNumberOf(c) ?? '',
      guestNameOf(c) ?? '',
      c.status ?? '',
      c.priority ?? '',
      c.description,
      c.submitted_at ?? '',
    ])
    downloadCsv(`complaints-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selected.length} complaint${selected.length === 1 ? '' : 's'}`)
  }

  return (
    <BulkActionBar
      count={selected.length}
      onClear={onClear}
      ariaLabel="Bulk complaint actions"
      actions={[
        { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyRefs },
        { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportCsv },
      ]}
    />
  )
}

'use client'

import { toast } from 'sonner'
import { Copy, Download } from 'lucide-react'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard } from '@/lib/export/entity-refs'
import { guestRef } from '@/lib/guests/guest-ref'
import type { GuestRow } from '@/lib/guests/guest-directory'

const STATUS_LABEL: Record<GuestRow['status'], string> = {
  active: 'Active',
  returning: 'Returning',
  vip: 'VIP',
  new: 'New',
}

interface GuestsBulkBarProps {
  selected: GuestRow[]
  onClear: () => void
}

export function GuestsBulkBar({ selected, onClear }: GuestsBulkBarProps) {
  if (selected.length === 0) return null

  const withPhone = selected.filter((g) => g.phone?.trim()).length

  function copyRefs() {
    void copyToClipboard(
      selected.map((g) => guestRef(g)).join(', '),
      `Copied ${selected.length} guest ref${selected.length === 1 ? '' : 's'}`,
    )
  }

  function copyPhones() {
    const phones = selected.map((g) => g.phone?.trim()).filter(Boolean) as string[]
    if (phones.length === 0) {
      toast.error('None of the selected guests have a phone number on file.')
      return
    }
    void copyToClipboard(
      phones.join(', '),
      `Copied ${phones.length} phone number${phones.length === 1 ? '' : 's'}`,
    )
  }

  function exportCsv() {
    const header = [
      'Reference',
      'Name',
      'Email',
      'Phone',
      'Room',
      'Status',
      'Stays',
      'Total spent',
      'Last stay',
      'Check-in',
      'Check-out',
    ]
    const rows = selected.map((g) => [
      guestRef(g),
      g.name,
      g.email ?? '',
      g.phone ?? '',
      g.roomNumber ?? '',
      STATUS_LABEL[g.status],
      String(g.totalStays),
      String(g.totalSpent),
      g.lastStay ?? '',
      g.checkIn ?? '',
      g.checkOut ?? '',
    ])
    downloadCsv(`guests-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selected.length} guest${selected.length === 1 ? '' : 's'}`)
  }

  return (
    <BulkActionBar
      count={selected.length}
      onClear={onClear}
      ariaLabel="Bulk guest actions"
      actions={[
        { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyRefs },
        {
          key: 'phones',
          label: `Copy phones (${withPhone})`,
          icon: Copy,
          onClick: copyPhones,
          hidden: withPhone === 0,
        },
        { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportCsv },
      ]}
    />
  )
}

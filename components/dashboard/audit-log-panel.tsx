'use client'

import { ClipboardList, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard, logRef } from '@/lib/export/entity-refs'
import { usePagination } from '@/lib/hooks/use-pagination'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import type { AuditLogEntry } from '@/lib/data/audit-log'

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function entityLabel(type: string) {
  switch (type) {
    case 'reservation':
      return 'Reservation'
    case 'room':
      return 'Room'
    case 'room_category':
      return 'Category'
    case 'hotel':
      return 'Property'
    case 'staff':
      return 'Staff'
    case 'guest':
      return 'Guest'
    case 'invoice':
      return 'Invoice'
    case 'complaint':
      return 'Complaint'
    default:
      return type
  }
}

interface AuditLogPanelProps {
  entries: AuditLogEntry[]
  compact?: boolean
}

export function AuditLogPanel({ entries, compact = false }: AuditLogPanelProps) {
  const selection = useRowSelection(entries, entries)
  const pagination = usePagination(entries)

  function copyRefs() {
    void copyToClipboard(
      selection.selected.map((e) => logRef(e.id, 'AUD')).join(', '),
      `Copied ${selection.selected.length} log ref${selection.selected.length === 1 ? '' : 's'}`,
    )
  }

  function exportCsv() {
    const header = ['Reference', 'When', 'Who', 'Type', 'Action', 'Summary']
    const rows = selection.selected.map((e) => [
      logRef(e.id, 'AUD'),
      e.createdAt,
      e.actorName?.trim() || 'Staff',
      entityLabel(e.entityType),
      e.action,
      e.summary,
    ])
    downloadCsv(`activity-log-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selection.selected.length} log entr${selection.selected.length === 1 ? 'y' : 'ies'}`)
  }

  return (
    <>
      <BulkActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        ariaLabel="Bulk activity log actions"
        actions={[
          { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyRefs },
          { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportCsv },
        ]}
      />

      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#3C216C]" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Activity log</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Check-ins, bookings, rate changes, room updates, property settings, and guest rules.
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BulkSelectCheckbox
                checked={selection.allFilteredSelected}
                onChange={selection.toggleAllFiltered}
                aria-label="Select all log entries"
              />
              Select all
            </label>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No activity recorded yet. Check-ins, reservations, room changes, and settings updates appear here.
          </p>
        ) : (
          <>
          <div className="data-table-wrap overflow-x-auto px-4 sm:px-6">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <BulkSelectCheckbox
                      checked={selection.allFilteredSelected}
                      onChange={selection.toggleAllFiltered}
                      aria-label="Select all visible log entries"
                    />
                  </th>
                  <th className="text-left font-semibold text-foreground">When</th>
                  <th className="text-left font-semibold text-foreground">Who</th>
                  {!compact && (
                    <th className="text-left font-semibold text-foreground">Type</th>
                  )}
                  <th className="text-left font-semibold text-foreground">Summary</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((entry) => (
                  <tr
                    key={entry.id}
                    className={selection.isSelected(entry.id) ? 'is-selected' : ''}
                  >
                    <td>
                      <BulkSelectCheckbox
                        checked={selection.isSelected(entry.id)}
                        onChange={() => selection.toggle(entry.id)}
                        aria-label={`Select log entry ${logRef(entry.id, 'AUD')}`}
                      />
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatWhen(entry.createdAt)}
                    </td>
                    <td className="text-foreground">
                      {entry.actorName?.trim() || 'Staff'}
                    </td>
                    {!compact && (
                      <td className="text-muted-foreground">
                        {entityLabel(entry.entityType)}
                      </td>
                    )}
                    <td className="text-foreground">{entry.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.setPage}
          />
          </>
        )}
      </div>
    </>
  )
}

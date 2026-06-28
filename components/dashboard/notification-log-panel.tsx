'use client'

import { MessageSquare, Smartphone, Mail, Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard, logRef } from '@/lib/export/entity-refs'
import { usePagination } from '@/lib/hooks/use-pagination'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import type { NotificationLogEntry } from '@/lib/data/notification-log'

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusClass(status: NotificationLogEntry['status']) {
  switch (status) {
    case 'sent':
      return 'bg-emerald-500/10 text-emerald-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    case 'skipped':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-[#E9ECEF] text-[#5E5872]'
  }
}

interface NotificationLogPanelProps {
  entries: NotificationLogEntry[]
  compact?: boolean
}

export function NotificationLogPanel({ entries, compact = false }: NotificationLogPanelProps) {
  const selection = useRowSelection(entries, entries)
  const pagination = usePagination(entries)

  function copyRecipients() {
    const recipients = selection.selected
      .map((e) => e.recipientEmail ?? e.recipientPhone ?? '')
      .filter(Boolean)
    if (recipients.length === 0) {
      toast.error('No recipients found in selection.')
      return
    }
    void copyToClipboard(
      recipients.join(', '),
      `Copied ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`,
    )
  }

  function exportCsv() {
    const header = ['Reference', 'When', 'To', 'Channel', 'Template', 'Status', 'Message']
    const rows = selection.selected.map((e) => [
      logRef(e.id, 'MSG'),
      e.createdAt,
      e.recipientEmail ?? e.recipientPhone ?? '',
      e.channel,
      e.templateKey,
      e.status,
      e.body,
    ])
    downloadCsv(`notifications-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selection.selected.length} message${selection.selected.length === 1 ? '' : 's'}`)
  }

  return (
    <>
      <BulkActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        ariaLabel="Bulk notification log actions"
        actions={[
          { key: 'recipients', label: 'Copy recipients', icon: Copy, onClick: copyRecipients },
          { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportCsv },
        ]}
      />

      <div id="sms-log" className="surface-card overflow-hidden scroll-mt-24">
        <div className="surface-card-accent" />
        <div className="surface-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#3C216C]" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">SMS, email & WhatsApp log</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Recent outbound messages from the system.
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BulkSelectCheckbox
                checked={selection.allFilteredSelected}
                onChange={selection.toggleAllFiltered}
                aria-label="Select all messages"
              />
              Select all
            </label>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No messages logged yet. Alerts appear here when SMS or WhatsApp is sent.
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
                      aria-label="Select all visible messages"
                    />
                  </th>
                  <th className="text-left font-semibold text-foreground">When</th>
                  <th className="text-left font-semibold text-foreground">To</th>
                  {!compact && (
                    <th className="text-left font-semibold text-foreground">Template</th>
                  )}
                  <th className="text-left font-semibold text-foreground">Channel</th>
                  <th className="text-left font-semibold text-foreground">Status</th>
                  {!compact && (
                    <th className="text-left font-semibold text-foreground">Message</th>
                  )}
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
                        aria-label={`Select message to ${entry.recipientEmail ?? entry.recipientPhone ?? 'recipient'}`}
                      />
                    </td>
                    <td className="whitespace-nowrap text-muted-foreground">
                      {formatWhen(entry.createdAt)}
                    </td>
                    <td className="font-mono text-xs text-foreground">
                      {entry.recipientEmail ?? entry.recipientPhone ?? '—'}
                    </td>
                    {!compact && (
                      <td className="text-foreground">{entry.templateKey}</td>
                    )}
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        {entry.channel === 'whatsapp' ? (
                          <MessageSquare className="h-3.5 w-3.5" />
                        ) : entry.channel === 'email' ? (
                          <Mail className="h-3.5 w-3.5" />
                        ) : (
                          <Smartphone className="h-3.5 w-3.5" />
                        )}
                        {entry.channel}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(entry.status)}`}
                      >
                        {entry.status}
                      </span>
                      {entry.status === 'failed' && entry.errorMessage && !compact && (
                        <p className="mt-1 text-xs text-red-600">{entry.errorMessage}</p>
                      )}
                    </td>
                    {!compact && (
                      <td className="max-w-xs text-muted-foreground">
                        <p className="line-clamp-2">{entry.body}</p>
                      </td>
                    )}
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

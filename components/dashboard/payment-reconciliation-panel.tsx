'use client'

import type { PaymentRecordRow, PaymentReconciliationSummary } from '@/lib/data/payments'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { usePagination } from '@/lib/hooks/use-pagination'

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface PaymentReconciliationPanelProps {
  summary: PaymentReconciliationSummary | null
  records: PaymentRecordRow[]
}

export function PaymentReconciliationPanel({ summary, records }: PaymentReconciliationPanelProps) {
  const pagination = usePagination(records)

  if (!summary) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Total collected" value={money(summary.totalCollected)} />
        <StatTile label="Manual / front desk" value={money(summary.manualCollected)} />
        <StatTile label="Outstanding AR" value={money(summary.pendingInvoiceBalance)} accent="amber" />
      </div>

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h2 className="text-lg font-semibold">Payment ledger</h2>
          <p className="text-sm text-muted-foreground">
            {summary.recordCount} successful payment{summary.recordCount === 1 ? '' : 's'} on record
          </p>
        </div>
        {records.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No payment records yet.</p>
        ) : (
          <>
            <div className="data-table-wrap overflow-x-auto px-4 sm:px-6">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-left">Invoice</th>
                    <th className="text-left">Guest</th>
                    <th className="text-left">Provider</th>
                    <th className="text-left">Reference</th>
                    <th className="text-right">Amount</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedItems.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">
                        {row.completedAt
                          ? new Date(row.completedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="font-medium">{row.invoiceLabel ?? '—'}</td>
                      <td>{row.guestName ?? '—'}</td>
                      <td className="capitalize">{row.provider}</td>
                      <td className="max-w-[140px] truncate text-muted-foreground">
                        {row.providerReference ?? '—'}
                      </td>
                      <td
                        className={`text-right font-semibold tabular-nums ${row.amount < 0 ? 'text-red-600' : ''}`}
                      >
                        {money(row.amount)}
                      </td>
                      <td className="capitalize">{row.status}</td>
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
    </div>
  )
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'purple' | 'amber'
}) {
  const accentClass =
    accent === 'purple'
      ? 'stat-tile stat-tile-purple'
      : accent === 'amber'
        ? 'stat-tile stat-tile-amber'
        : 'stat-tile stat-tile-emerald'

  return (
    <div className={`surface-card ${accentClass} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}

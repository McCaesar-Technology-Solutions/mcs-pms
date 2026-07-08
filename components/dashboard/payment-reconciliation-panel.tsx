'use client'

import type { PaymentRecordRow, PaymentReconciliationSummary } from '@/lib/data/payments'
import { formatGhs, MONEY_CLASS } from '@/lib/format/money'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { usePagination } from '@/lib/hooks/use-pagination'

function formatRowDate(completedAt: string | null) {
  if (!completedAt) return '—'
  return new Date(completedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
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
        <StatTile label="Total collected" value={formatGhs(summary.totalCollected)} />
        <StatTile label="Manual / front desk" value={formatGhs(summary.manualCollected)} />
        <StatTile label="Outstanding AR" value={formatGhs(summary.pendingInvoiceBalance)} accent="amber" />
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
            <div className="space-y-3 p-4 md:hidden">
              {pagination.paginatedItems.map((row) => (
                <div key={row.id} className="elevated-list-item p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{row.invoiceLabel ?? '—'}</p>
                      <p className="mt-0.5 text-sm text-foreground">{row.guestName ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{formatRowDate(row.completedAt)}</p>
                    </div>
                    <p
                      className={`text-lg font-bold tabular-nums ${MONEY_CLASS} ${row.amount < 0 ? 'text-red-600' : 'text-foreground'}`}
                    >
                      {formatGhs(row.amount)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{row.provider}</span>
                    <span>·</span>
                    <span className="capitalize">{row.status}</span>
                    {row.providerReference && (
                      <>
                        <span>·</span>
                        <span className="truncate">{row.providerReference}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden data-table-wrap overflow-x-auto px-4 sm:px-6 md:block">
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
                        {formatRowDate(row.completedAt)}
                      </td>
                      <td className="font-medium">{row.invoiceLabel ?? '—'}</td>
                      <td>{row.guestName ?? '—'}</td>
                      <td className="capitalize">{row.provider}</td>
                      <td className="max-w-[140px] truncate text-muted-foreground">
                        {row.providerReference ?? '—'}
                      </td>
                      <td
                        className={`text-right font-semibold tabular-nums ${MONEY_CLASS} ${row.amount < 0 ? 'text-red-600' : ''}`}
                      >
                        {formatGhs(row.amount)}
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
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-bold text-foreground ${MONEY_CLASS}`}>{value}</p>
    </div>
  )
}

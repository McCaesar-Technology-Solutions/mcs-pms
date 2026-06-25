'use client'

import type { PaymentRecordRow, PaymentReconciliationSummary } from '@/lib/data/payments'

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface PaymentReconciliationPanelProps {
  summary: PaymentReconciliationSummary | null
  records: PaymentRecordRow[]
}

export function PaymentReconciliationPanel({ summary, records }: PaymentReconciliationPanelProps) {
  if (!summary) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total collected" value={money(summary.totalCollected)} />
        <StatTile label="Paystack" value={money(summary.paystackCollected)} accent="purple" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E9ECEF] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Invoice</th>
                  <th className="px-6 py-3">Guest</th>
                  <th className="px-6 py-3">Provider</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id} className="border-b border-[#E9ECEF]/60">
                    <td className="px-6 py-3 whitespace-nowrap">
                      {row.completedAt
                        ? new Date(row.completedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-6 py-3 font-medium">{row.invoiceLabel ?? '—'}</td>
                    <td className="px-6 py-3">{row.guestName ?? '—'}</td>
                    <td className="px-6 py-3 capitalize">{row.provider}</td>
                    <td className="px-6 py-3 max-w-[140px] truncate text-muted-foreground">
                      {row.providerReference ?? '—'}
                    </td>
                    <td
                      className={`px-6 py-3 text-right font-semibold ${row.amount < 0 ? 'text-red-600' : ''}`}
                    >
                      {money(row.amount)}
                    </td>
                    <td className="px-6 py-3 capitalize">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

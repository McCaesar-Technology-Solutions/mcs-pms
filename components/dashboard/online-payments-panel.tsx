'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { OnlinePaymentRow } from '@/lib/data/online-payments'
import { markPaymentAbandoned } from '@/app/actions/payments'
import { formatGhs, MONEY_CLASS } from '@/lib/format/money'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { usePagination } from '@/lib/hooks/use-pagination'

function formatRowDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusClass(status: string) {
  switch (status) {
    case 'success':
      return 'bg-emerald-100 text-emerald-800'
    case 'pending':
      return 'bg-amber-100 text-amber-900'
    case 'failed':
    case 'abandoned':
      return 'bg-red-100 text-red-800'
    case 'refunded':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

interface OnlinePaymentsPanelProps {
  payments: OnlinePaymentRow[]
  enabled: boolean
}

export function OnlinePaymentsPanel({ payments, enabled }: OnlinePaymentsPanelProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const pagination = usePagination(payments)

  if (!enabled) {
    return (
      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold">Online payments</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Online payments are disabled for this deployment. Set{' '}
          <code className="text-xs">PAYMENTS_ENABLED=true</code> and configure Paystack to turn
          this on.
        </p>
      </div>
    )
  }

  function abandon(paymentId: string) {
    startTransition(async () => {
      const result = await markPaymentAbandoned({ paymentId })
      if (result.success) {
        toast.success('Payment marked abandoned')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h2 className="text-lg font-semibold">Online payments</h2>
          <p className="text-sm text-muted-foreground">
            Paystack attempts for this property. Pending MoMo checkouts often mean the guest closed
            the tab — follow up, then mark abandoned after 30 minutes if needed.
          </p>
        </div>

        {payments.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No online payments yet.</p>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {pagination.paginatedItems.map((row) => (
                <div key={row.id} className="elevated-list-item space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.guestName ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">{row.invoiceLabel ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{formatRowDate(row.createdAt)}</p>
                    </div>
                    <p className={`text-lg font-bold tabular-nums ${MONEY_CLASS}`}>
                      {formatGhs(row.amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded px-2 py-0.5 capitalize ${statusClass(row.status)}`}>
                      {row.status}
                    </span>
                    <span className="text-muted-foreground">{row.channel ?? '—'}</span>
                    <span className="truncate text-muted-foreground">{row.providerReference}</span>
                  </div>
                  {row.canMarkAbandoned && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={pending}
                      onClick={() => abandon(row.id)}
                    >
                      Mark abandoned
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden data-table-wrap overflow-x-auto px-4 sm:px-6 md:block">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">When</th>
                    <th className="text-left">Guest</th>
                    <th className="text-left">Invoice</th>
                    <th className="text-left">Channel</th>
                    <th className="text-left">Reference</th>
                    <th className="text-right">Amount</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedItems.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">{formatRowDate(row.createdAt)}</td>
                      <td>{row.guestName ?? '—'}</td>
                      <td className="font-medium">{row.invoiceLabel ?? '—'}</td>
                      <td className="capitalize">{row.channel ?? '—'}</td>
                      <td className="max-w-[160px] truncate text-muted-foreground">
                        {row.providerReference}
                      </td>
                      <td className={`text-right tabular-nums ${MONEY_CLASS}`}>
                        {formatGhs(row.amount)}
                      </td>
                      <td>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs capitalize ${statusClass(row.status)}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>
                        {row.canMarkAbandoned ? (
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            disabled={pending}
                            onClick={() => abandon(row.id)}
                          >
                            Mark abandoned
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
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

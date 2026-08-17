'use client'

import type { StayPaymentHistoryRow } from '@/lib/data/stay-payment-history'

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface StayPaymentHistoryListProps {
  rows: StayPaymentHistoryRow[]
  loading?: boolean
}

export function StayPaymentHistoryList({ rows, loading }: StayPaymentHistoryListProps) {
  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">Loading payment history…</p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">Payment history</p>
      <ul className="soft-list max-h-36 space-y-1.5 overflow-y-auto text-xs">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{money(row.amount)}</p>
              <p className="text-muted-foreground">
                {row.paymentMethod ?? row.provider}
                {row.metadata?.backfill ? ' · backfill' : ''}
                {row.metadata?.type === 'deposit' ? ' · pre-arrival' : ''}
              </p>
            </div>
            <span className="shrink-0 text-muted-foreground">{formatWhen(row.completedAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

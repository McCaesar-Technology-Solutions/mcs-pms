'use client'

import { AlertCircle, CheckCircle } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { GraSummary } from '@/lib/data/overview'
import { formatGhsCompact, MONEY_CLASS } from '@/lib/format/money'

const statusConfig = {
  pending: { icon: AlertCircle, color: 'text-orange-600', label: 'Pending', bg: 'bg-orange-50' },
  submitted: { icon: CheckCircle, color: 'text-blue-600', label: 'Submitted', bg: 'bg-blue-50' },
  approved: { icon: CheckCircle, color: 'text-amber-600', label: 'Approved', bg: 'bg-amber-50' },
}

export function GRATaxSummary({ summary }: { summary?: GraSummary }) {
  if (!summary) {
    return (
      <DataEmptyState message="Issue invoices to track GRA tax compliance here." />
    )
  }

  const data = summary
  const config = statusConfig[data.status]
  const Icon = config.icon

  return (
    <div className="surface-card">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-foreground">GRA tax compliance</h3>
        <p className="text-sm text-muted-foreground mt-1">Ghana Revenue Authority filing status and amounts</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="info-block info-block-blue p-4">
            <p className="text-xs font-medium text-muted-foreground">Period</p>
            <p className="text-lg font-bold text-foreground mt-3">{data.period}</p>
          </div>
          <div className="info-block info-block-emerald p-4">
            <p className="text-xs font-medium text-muted-foreground">Total revenue</p>
            <p className={`text-lg font-bold text-foreground mt-3 ${MONEY_CLASS}`}>
              {formatGhsCompact(data.totalRevenue)}
            </p>
          </div>
          <div className="info-block info-block-orange p-4">
            <p className="text-xs font-medium text-muted-foreground">Tax amount</p>
            <p className={`text-lg font-bold text-foreground mt-3 ${MONEY_CLASS}`}>
              {formatGhsCompact(Math.round(data.totalTax))}
            </p>
          </div>
          <div className="info-block info-block-purple p-4">
            <p className="text-xs font-medium text-muted-foreground">Tax rate</p>
            <p className="text-lg font-bold text-foreground mt-3 tabular-nums">{(data.taxRate * 100).toFixed(0)}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="info-block info-block-blue p-5 shadow-elevation-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Invoices issued</p>
            <p className="text-3xl font-bold text-blue-600 tabular-nums">{data.invoicesIssued}</p>
          </div>
          <div className="info-block info-block-emerald p-5 shadow-elevation-1">
            <p className="text-xs font-medium text-muted-foreground mb-3">Invoices paid</p>
            <p className="text-3xl font-bold text-amber-600 tabular-nums">{data.invoicesPaid}</p>
          </div>
        </div>

        <div className={`flex items-center gap-3 p-4 rounded-xl shadow-elevation-1 ${config.bg}`}>
          <Icon className={`h-6 w-6 flex-shrink-0 ${config.color}`} />
          <div>
            <p className={`font-semibold text-sm ${config.color}`}>{config.label}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.status === 'pending' && 'Awaiting GRA submission'}
              {data.status === 'submitted' && 'Submitted to GRA for processing'}
              {data.status === 'approved' && 'Approved by Ghana Revenue Authority'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

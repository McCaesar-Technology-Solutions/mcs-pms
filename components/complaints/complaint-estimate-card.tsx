'use client'

import { Receipt } from 'lucide-react'
import { ComplaintInvoiceFileLink } from '@/components/complaints/complaint-invoice-file-link'
import type { ComplaintEstimate } from '@/types'
import { formatGhs, MONEY_CLASS } from '@/lib/format/money'

export function ComplaintEstimateCard({ estimate }: { estimate: ComplaintEstimate }) {
  const items = estimate.items ?? []

  return (
    <div className="surface-card overflow-hidden shadow-elevation-1">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Receipt className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-primary">Technician invoice</h3>
          {estimate.technician?.name && (
            <p className="text-xs text-muted-foreground">From {estimate.technician.name}</p>
          )}
        </div>
        {estimate.updated_at && (
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(estimate.updated_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        {estimate.invoice_file_name && (
          <ComplaintInvoiceFileLink
            complaintId={estimate.complaint_id}
            fileName={estimate.invoice_file_name}
          />
        )}

        {estimate.note && (
          <div className="surface-inset rounded-xl px-3 py-2.5 text-sm leading-relaxed text-foreground">
            <p className="text-xs font-medium text-muted-foreground">Technician note</p>
            <p className="mt-1">{estimate.note}</p>
          </div>
        )}

        {items.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {items.map((item) => (
                <div key={item.id} className="elevated-list-item p-3">
                  <p className="font-medium text-foreground">{item.material_name}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Qty {item.quantity}</span>
                    <span className={`font-semibold ${MONEY_CLASS}`}>{formatGhs(item.line_total)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl bg-background shadow-sm md:block">
              <table className="data-table w-full min-w-[280px] text-left text-sm">
                <thead className="bg-secondary/60 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">{item.material_name}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{item.quantity}</td>
                      <td className={`px-3 py-2 text-right text-muted-foreground ${MONEY_CLASS}`}>
                        {formatGhs(item.unit_cost)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${MONEY_CLASS}`}>
                        {formatGhs(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : estimate.total_cost > 0 ? (
          <p className="text-sm text-muted-foreground">No materials listed — labour only.</p>
        ) : estimate.invoice_file_name ? null : (
          <p className="text-sm text-muted-foreground">No line items — see uploaded file.</p>
        )}

        {(estimate.total_cost > 0 || items.length > 0) && (
          <div className="surface-inset rounded-xl px-4 py-3 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Materials subtotal</span>
              <span className={MONEY_CLASS}>{formatGhs(estimate.materials_total)}</span>
            </div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>Labour</span>
              <span className={MONEY_CLASS}>{formatGhs(estimate.labour_cost)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold text-primary">
              <span>Total</span>
              <span className={MONEY_CLASS}>{formatGhs(estimate.total_cost)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

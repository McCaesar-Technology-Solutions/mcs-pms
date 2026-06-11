'use client'

import { Receipt } from 'lucide-react'
import type { ComplaintEstimate } from '@/types'

function formatMoney(n: number) {
  return `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ComplaintEstimateCard({ estimate }: { estimate: ComplaintEstimate }) {
  const items = estimate.items ?? []

  return (
    <div className="overflow-hidden rounded-2xl border border-[#3C216C]/15 bg-gradient-to-b from-[#3C216C]/8 to-white shadow-elevation-1">
      <div className="flex items-center gap-2 border-b border-[#3C216C]/10 px-4 py-3">
        <Receipt className="h-4 w-4 text-[#3C216C]" />
        <div>
          <h3 className="text-sm font-semibold text-[#3C216C]">Technician cost estimate</h3>
          {estimate.technician?.name && (
            <p className="text-xs text-muted-foreground">From {estimate.technician.name}</p>
          )}
        </div>
        {estimate.updated_at && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {new Date(estimate.updated_at).toLocaleString()}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {estimate.note && (
          <div className="rounded-xl bg-white/80 px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Technician note
            </p>
            <p className="mt-1">{estimate.note}</p>
          </div>
        )}

        {items.length > 0 ? (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full min-w-[280px] text-left text-sm">
              <thead className="bg-[#F7F4FB] text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit</th>
                  <th className="px-3 py-2 text-right">Line</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[#E9ECEF]">
                    <td className="px-3 py-2 font-medium text-foreground">{item.material_name}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatMoney(item.unit_cost)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatMoney(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No materials listed — labour only.</p>
        )}

        <div className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Materials subtotal</span>
            <span>{formatMoney(estimate.materials_total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-muted-foreground">
            <span>Labour</span>
            <span>{formatMoney(estimate.labour_cost)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-[#E9ECEF] pt-2 text-base font-bold text-[#3C216C]">
            <span>Total estimate</span>
            <span>{formatMoney(estimate.total_cost)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

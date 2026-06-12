'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Send, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchComplaintEstimate,
  submitComplaintEstimate,
} from '@/app/actions/complaint-estimates'
import type { ComplaintEstimate } from '@/types'

interface MaterialRow {
  key: string
  materialName: string
  quantity: string
  unitCost: string
}

function emptyRow(): MaterialRow {
  return {
    key: crypto.randomUUID(),
    materialName: '',
    quantity: '1',
    unitCost: '',
  }
}

function formatMoney(n: number) {
  return `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface ComplaintEstimateFormProps {
  complaintId: string
  roomNumber?: string | null
  category?: string | null
  disabled?: boolean
  onSubmitted?: (estimate: ComplaintEstimate) => void
}

export function ComplaintEstimateForm({
  complaintId,
  roomNumber,
  category,
  disabled,
  onSubmitted,
}: ComplaintEstimateFormProps) {
  const [note, setNote] = useState('')
  const [labourCost, setLabourCost] = useState('')
  const [rows, setRows] = useState<MaterialRow[]>([emptyRow()])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [hasExisting, setHasExisting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchComplaintEstimate(complaintId).then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        const est = result.data
        setHasExisting(true)
        setNote(est.note ?? '')
        setLabourCost(String(est.labour_cost))
        setSavedAt(est.updated_at ?? est.created_at)
        if (est.items && est.items.length > 0) {
          setRows(
            est.items.map((item) => ({
              key: item.id,
              materialName: item.material_name,
              quantity: String(item.quantity),
              unitCost: String(item.unit_cost),
            })),
          )
        } else {
          setRows([emptyRow()])
        }
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [complaintId])

  const { materialsTotal, labour, grandTotal } = useMemo(() => {
    const materials = rows.reduce((sum, row) => {
      const q = parseFloat(row.quantity) || 0
      const u = parseFloat(row.unitCost) || 0
      return sum + q * u
    }, 0)
    const labourNum = parseFloat(labourCost) || 0
    return {
      materialsTotal: Math.round(materials * 100) / 100,
      labour: Math.round(labourNum * 100) / 100,
      grandTotal: Math.round((materials + labourNum) * 100) / 100,
    }
  }, [rows, labourCost])

  function updateRow(key: string, patch: Partial<MaterialRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return

    setError(null)
    setSaving(true)

    const materials = rows
      .filter((r) => r.materialName.trim())
      .map((r) => ({
        materialName: r.materialName.trim(),
        quantity: parseFloat(r.quantity) || 0,
        unitCost: parseFloat(r.unitCost) || 0,
      }))

    const result = await submitComplaintEstimate({
      complaintId,
      note,
      labourCost: parseFloat(labourCost) || 0,
      materials,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setHasExisting(true)
    setSavedAt(new Date().toISOString())
    toast.success('Invoice sent — manager must approve before you can start work.')
    if (result.data) onSubmitted?.(result.data)
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-white px-3 py-4 text-center text-sm text-muted-foreground shadow-elevation-1">
        Loading estimate…
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-4 shadow-elevation-1">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-[#3C216C]" />
        <h3 className="text-sm font-semibold text-[#3C216C]">Submit invoice to manager</h3>
      </div>
      {(roomNumber || category) && (
        <p className="text-xs font-semibold text-[#3C216C]">
          {[roomNumber ? `Room ${roomNumber}` : null, category ? category.replace(/_/g, ' ') : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Step 1: List materials and labour, then submit for manager approval. You can only start
        work after the invoice is approved.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Materials
          </label>
          <button
            type="button"
            onClick={addRow}
            disabled={disabled || saving}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#3C216C] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#E9ECEF]">
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead className="bg-[#F7F4FB] text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Material</th>
                <th className="w-16 px-2 py-2">Qty</th>
                <th className="w-20 px-2 py-2">Unit ₵</th>
                <th className="w-16 px-2 py-2 text-right">Line</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const line =
                  Math.round(
                    (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0) * 100,
                  ) / 100
                return (
                  <tr key={row.key} className="border-t border-[#E9ECEF]">
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.materialName}
                        onChange={(e) => updateRow(row.key, { materialName: e.target.value })}
                        placeholder="e.g. PVC pipe"
                        disabled={disabled || saving}
                        className="w-full rounded-md border-0 bg-[#F7F4FB] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3C216C]/15"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={row.quantity}
                        onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                        disabled={disabled || saving}
                        className="w-full rounded-md border-0 bg-[#F7F4FB] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3C216C]/15"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unitCost}
                        onChange={(e) => updateRow(row.key, { unitCost: e.target.value })}
                        placeholder="0"
                        disabled={disabled || saving}
                        className="w-full rounded-md border-0 bg-[#F7F4FB] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#3C216C]/15"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold text-foreground">
                      {formatMoney(line)}
                    </td>
                    <td className="px-1 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={disabled || saving || rows.length <= 1}
                        className="rounded p-1 text-muted-foreground hover:text-red-600 disabled:opacity-30"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Labour cost (₵)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={labourCost}
          onChange={(e) => setLabourCost(e.target.value)}
          placeholder="0.00"
          disabled={disabled || saving}
          className="mt-1.5 w-full rounded-xl border-0 bg-[#F7F4FB] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3C216C]/15"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Note to manager
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Scope of work, timeline, assumptions…"
          rows={3}
          disabled={disabled || saving}
          className="mt-1.5 w-full resize-none rounded-xl border-0 bg-[#F7F4FB] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3C216C]/15"
        />
      </div>

      <div className="rounded-xl bg-[#3C216C]/6 px-3 py-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Materials</span>
          <span>{formatMoney(materialsTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-muted-foreground">
          <span>Labour</span>
          <span>{formatMoney(labour)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-[#3C216C]/10 pt-2 font-bold text-[#3C216C]">
          <span>Invoice total</span>
          <span>{formatMoney(grandTotal)}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {hasExisting && savedAt && !error && (
        <p className="text-center text-xs text-emerald-700">
          Invoice submitted · manager notified · {new Date(savedAt).toLocaleString()}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {saving
          ? 'Submitting…'
          : hasExisting
            ? 'Update & resubmit invoice'
            : 'Submit invoice to manager'}
      </button>
    </form>
  )
}

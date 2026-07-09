'use client'

import { useEffect, useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { loadInventoryItemsForStaff } from '@/app/actions/inventory'
import { suggestCleanConsumption } from '@/lib/inventory/clean-consumption'
import type { HousekeepingTaskType } from '@/types'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { FormField } from '@/components/ui/form-field'

export interface InventoryUsageLine {
  itemId: string
  name: string
  quantity: number
}

interface HousekeepingInventoryModalProps {
  taskType: HousekeepingTaskType
  roomNumber: string | null
  open: boolean
  onClose: () => void
  onConfirm: (lines: InventoryUsageLine[]) => void
}

interface StockOption {
  id: string
  name: string
  category: string
  unit: string
  quantityInStock: number
}

export function HousekeepingInventoryModal({
  taskType,
  roomNumber,
  open,
  onClose,
  onConfirm,
}: HousekeepingInventoryModalProps) {
  const [items, setItems] = useState<StockOption[]>([])
  const [lines, setLines] = useState<InventoryUsageLine[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void loadInventoryItemsForStaff().then((result) => {
      if (result.success && result.data) {
        setItems(result.data)
        if (taskType === 'clean') {
          setLines(
            suggestCleanConsumption(result.data).map((s) => ({
              itemId: s.itemId,
              name: s.name,
              quantity: s.quantity,
            })),
          )
        } else {
          setLines([])
        }
      }
      setLoading(false)
    })
  }, [open, taskType])

  function addLine() {
    const first = items[0]
    if (!first) return
    setLines((prev) => [...prev, { itemId: first.id, name: first.name, quantity: 1 }])
  }

  function updateLine(index: number, patch: Partial<InventoryUsageLine>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line
        const next = { ...line, ...patch }
        if (patch.itemId) {
          const item = items.find((x) => x.id === patch.itemId)
          if (item) next.name = item.name
        }
        return next
      }),
    )
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const title =
    taskType === 'restock'
      ? 'Log restock usage'
      : taskType === 'clean'
        ? 'Log turnover supplies'
        : 'Log inventory usage'

  return (
    <CenteredModal open={open} onClose={onClose} className="max-w-lg" aria-label={title}>
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {roomNumber ? `Room ${roomNumber} · ` : ''}
          {taskType === 'clean'
            ? 'Confirm supplies used during this clean (optional).'
            : 'Record items taken from stores for this restock (optional).'}
        </p>
      </ModalHeader>
      <ModalBody className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading inventory…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No inventory items yet. You can still complete the task without logging usage.
          </p>
        ) : (
          <>
            {lines.map((line, index) => (
              <div key={`${line.itemId}-${index}`} className="flex flex-wrap items-end gap-2">
                <FormField label="Item" className="min-w-[140px] flex-1">
                  <select
                    value={line.itemId}
                    onChange={(e) => updateLine(index, { itemId: e.target.value })}
                    className="app-field w-full"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.quantityInStock} {item.unit})
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Qty" className="w-24">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Number(e.target.value) || 1 })}
                    className="app-field w-full"
                  />
                </FormField>
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              onConfirm(lines.filter((l) => l.quantity > 0))
            })
          }
          className="app-btn app-btn-primary"
        >
          Complete task
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

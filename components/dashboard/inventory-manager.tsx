'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createInventoryItem, deleteInventoryItem, updateInventoryItem } from '@/app/actions/inventory'
import type { InventoryRow } from '@/lib/data/inventory'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'

interface InventoryManagerProps {
  items: InventoryRow[]
  canDelete?: boolean
}

export function InventoryManager({ items, canDelete = false }: InventoryManagerProps) {
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()
  const lowStock = items.filter((i) => i.lowStock)

  return (
    <div className="space-y-6">
      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {lowStock.length} item{lowStock.length === 1 ? '' : 's'} at or below reorder level.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="app-btn app-btn-primary inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>

      <div className="surface-card overflow-hidden">
        {items.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            Track linens, amenities, and supplies with reorder alerts.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="data-table-wrap px-4 pb-4 pt-2">
              <table className="data-table w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>In stock</th>
                    <th>Reorder at</th>
                    <th>Unit</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td className="text-muted-foreground">{item.category}</td>
                      <td>
                        <InlineStockEditor item={item} disabled={pending} />
                      </td>
                      <td className="text-muted-foreground">{item.reorderLevel}</td>
                      <td className="text-muted-foreground">{item.unit}</td>
                      <td>
                      {canDelete && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              const result = await deleteInventoryItem(item.id)
                              if (result.success) toast.success('Item removed')
                              else toast.error(result.error ?? 'Delete failed')
                            })
                          }}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {creating && <InventoryFormModal onClose={() => setCreating(false)} onDone={() => setCreating(false)} />}
    </div>
  )
}

function InlineStockEditor({ item, disabled }: { item: InventoryRow; disabled: boolean }) {
  const [value, setValue] = useState(String(item.quantityInStock))
  const [, startTransition] = useTransition()

  function commit() {
    const next = Number(value)
    if (Number.isNaN(next) || next === item.quantityInStock) return
    startTransition(async () => {
      const result = await updateInventoryItem(item.id, { quantityInStock: next })
      if (result.success) toast.success('Stock updated')
      else toast.error(result.error ?? 'Update failed')
    })
  }

  return (
    <input
      type="number"
      min={0}
      value={value}
      disabled={disabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      className={`app-field app-field--compact w-20 ${item.lowStock ? 'border-amber-300 bg-amber-50/80' : ''}`}
    />
  )
}

function InventoryFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('general')
  const [quantityInStock, setQuantityInStock] = useState('0')
  const [reorderLevel, setReorderLevel] = useState('5')
  const [unit, setUnit] = useState('unit')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await createInventoryItem({
        name,
        category,
        quantityInStock: Number(quantityInStock),
        reorderLevel: Number(reorderLevel),
        unit,
        notes: notes || undefined,
      })
      if (result.success) {
        toast.success('Item added')
        onDone()
      } else {
        setError(result.error ?? 'Could not save item')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label="Add inventory item">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Add inventory item</h3>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} className="app-field w-full" />
        <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="app-field w-full" />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" min={0} placeholder="In stock" value={quantityInStock} onChange={(e) => setQuantityInStock(e.target.value)} className="app-field w-full" />
          <input type="number" min={0} placeholder="Reorder at" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} className="app-field w-full" />
        </div>
        <input placeholder="Unit (e.g. bottle, pack)" value={unit} onChange={(e) => setUnit(e.target.value)} className="app-field w-full" />
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="app-field w-full" />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">Cancel</button>
        <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">Save</button>
      </ModalFooter>
    </CenteredModal>
  )
}

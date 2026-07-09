'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, History, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { toast } from 'sonner'
import {
  createInventoryItem,
  deleteInventoryItem,
  receiveInventoryStock,
  updateInventoryItem,
} from '@/app/actions/inventory'
import type { InventoryRow } from '@/lib/data/inventory'
import { INVENTORY_CATEGORIES } from '@/lib/inventory/categories'
import type { InventoryMovementRow } from '@/lib/inventory/movements'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { FormField } from '@/components/ui/form-field'

interface InventoryManagerProps {
  items: InventoryRow[]
  movements: InventoryMovementRow[]
  canDelete?: boolean
  canRecordExpense?: boolean
}

const REASON_LABELS: Record<string, string> = {
  received: 'Received',
  used: 'Used',
  adjusted: 'Adjusted',
  wasted: 'Wasted',
  restock: 'Room restock',
  clean: 'Turnover clean',
  maintenance: 'Maintenance',
}

export function InventoryManager({
  items,
  movements,
  canDelete = false,
  canRecordExpense = false,
}: InventoryManagerProps) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<InventoryRow | null>(null)
  const [receiving, setReceiving] = useState<InventoryRow | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'name' | 'low_stock' | 'category'>('low_stock')
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        (item.notes?.toLowerCase().includes(q) ?? false)
      )
    })
    if (sort === 'low_stock') {
      list = [...list].sort((a, b) => {
        if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    } else if (sort === 'category') {
      list = [...list].sort(
        (a, b) =>
          a.categoryLabel.localeCompare(b.categoryLabel) || a.name.localeCompare(b.name),
      )
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    return list
  }, [items, query, category, sort])

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

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="app-field min-w-[180px] flex-1"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="app-field"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {INVENTORY_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="app-field"
          aria-label="Sort items"
        >
          <option value="low_stock">Low stock first</option>
          <option value="name">Name</option>
          <option value="category">Category</option>
        </select>
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
        {filtered.length === 0 ? (
          <DataEmptyState
            borderless
            icon={Package}
            title={items.length === 0 ? 'Start tracking inventory' : 'No matching items'}
            message={
              items.length === 0
                ? 'Track linens, amenities, and supplies with reorder alerts and a full movement history.'
                : 'Try a different search or category filter.'
            }
            action={
              items.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="app-btn app-btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add first item
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {filtered.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  pending={pending}
                  canDelete={canDelete}
                  onEdit={() => setEditing(item)}
                  onReceive={() => setReceiving(item)}
                  onDelete={() => {
                    startTransition(async () => {
                      const result = await deleteInventoryItem(item.id)
                      if (result.success) toast.success('Item removed')
                      else toast.error(result.error ?? 'Delete failed')
                    })
                  }}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <div className="data-table-wrap px-4 pb-4 pt-2">
                <table className="data-table w-full min-w-[760px]">
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
                    {filtered.map((item) => (
                      <tr key={item.id} className={item.lowStock ? 'bg-amber-50/40' : undefined}>
                        <td>
                          <p className="font-medium">{item.name}</p>
                          {item.notes && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.notes}</p>
                          )}
                        </td>
                        <td className="text-muted-foreground">{item.categoryLabel}</td>
                        <td>
                          <span
                            className={`font-semibold tabular-nums ${item.lowStock ? 'text-amber-800' : ''}`}
                          >
                            {item.quantityInStock}
                          </span>
                        </td>
                        <td className="text-muted-foreground tabular-nums">{item.reorderLevel}</td>
                        <td className="text-muted-foreground">{item.unit}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setReceiving(item)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              Receive
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(item)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                              aria-label="Edit item"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {movements.length > 0 && (
        <section className="surface-card overflow-hidden">
          <div className="surface-card-header flex items-center gap-2">
            <History className="h-5 w-5 text-[var(--comp-sand)]" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent movements</h3>
              <p className="text-sm text-muted-foreground">Who changed stock and why</p>
            </div>
          </div>
          <div className="list-stack max-h-80 overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="list-row flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {m.itemName}
                    <span
                      className={`ml-2 tabular-nums ${m.delta > 0 ? 'text-emerald-700' : 'text-amber-800'}`}
                    >
                      {m.delta > 0 ? '+' : ''}
                      {m.delta}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {REASON_LABELS[m.reason] ?? m.reason}
                    {m.createdByName ? ` · ${m.createdByName}` : ''}
                    {' · '}
                    {new Date(m.createdAt).toLocaleString('en-GB', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {m.note && <p className="mt-0.5 text-xs text-muted-foreground">{m.note}</p>}
                </div>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  → {m.quantityAfter} in stock
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <ItemFormModal title="Add inventory item" onClose={() => setCreating(false)} />
      )}
      {editing && (
        <ItemFormModal
          title="Edit item"
          item={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {receiving && (
        <ReceiveStockModal
          item={receiving}
          canRecordExpense={canRecordExpense}
          onClose={() => setReceiving(null)}
        />
      )}
    </div>
  )
}

function InventoryCard({
  item,
  pending,
  canDelete,
  onEdit,
  onReceive,
  onDelete,
}: {
  item: InventoryRow
  pending: boolean
  canDelete: boolean
  onEdit: () => void
  onReceive: () => void
  onDelete: () => void
}) {
  return (
    <div className={`elevated-list-item p-4 ${item.lowStock ? 'ring-1 ring-amber-200' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="text-sm text-muted-foreground">{item.categoryLabel}</p>
          {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            Reorder at {item.reorderLevel} {item.unit}
          </p>
        </div>
        <p className={`shrink-0 text-lg font-bold tabular-nums ${item.lowStock ? 'text-amber-800' : ''}`}>
          {item.quantityInStock}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <button type="button" onClick={onReceive} className="app-btn app-btn-secondary text-xs">
          Receive stock
        </button>
        <button type="button" onClick={onEdit} className="app-btn app-btn-ghost text-xs">
          Edit
        </button>
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="ml-auto text-xs font-semibold text-destructive"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function ItemFormModal({
  title,
  item,
  onClose,
}: {
  title: string
  item?: InventoryRow
  onClose: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? 'general')
  const [quantityInStock, setQuantityInStock] = useState(String(item?.quantityInStock ?? 0))
  const [reorderLevel, setReorderLevel] = useState(String(item?.reorderLevel ?? 5))
  const [unit, setUnit] = useState(item?.unit ?? 'unit')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const payload = {
        name,
        category,
        quantityInStock: Number(quantityInStock),
        reorderLevel: Number(reorderLevel),
        unit,
        notes: notes || undefined,
      }
      const result = item
        ? await updateInventoryItem(item.id, payload)
        : await createInventoryItem(payload)
      if (result.success) {
        toast.success(item ? 'Item updated' : 'Item added')
        onClose()
      } else {
        setError(result.error ?? 'Could not save item')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label={title}>
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <FormField label="Item name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="app-field w-full" />
        </FormField>
        <FormField label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="app-field w-full">
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="In stock">
            <input
              type="number"
              min={0}
              value={quantityInStock}
              onChange={(e) => setQuantityInStock(e.target.value)}
              className="app-field w-full"
            />
          </FormField>
          <FormField label="Reorder at">
            <input
              type="number"
              min={0}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              className="app-field w-full"
            />
          </FormField>
        </div>
        <FormField label="Unit">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className="app-field w-full" />
        </FormField>
        <FormField label="Notes">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="app-field w-full" />
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">
          Save
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

function ReceiveStockModal({
  item,
  canRecordExpense,
  onClose,
}: {
  item: InventoryRow
  canRecordExpense: boolean
  onClose: () => void
}) {
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [vendor, setVendor] = useState('')
  const [note, setNote] = useState('')
  const [createExpense, setCreateExpense] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await receiveInventoryStock({
        itemId: item.id,
        quantity: Number(quantity),
        unitCost: unitCost ? Number(unitCost) : undefined,
        vendor: vendor || undefined,
        note: note || undefined,
        createExpense: createExpense && canRecordExpense,
      })
      if (result.success) {
        toast.success('Stock received')
        onClose()
      } else {
        setError(result.error ?? 'Could not receive stock')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Receive stock">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Receive stock</h3>
        <p className="text-sm text-muted-foreground">{item.name}</p>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <FormField label="Quantity received">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="app-field w-full"
          />
        </FormField>
        {canRecordExpense && (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createExpense}
                onChange={(e) => setCreateExpense(e.target.checked)}
              />
              Record as expense
            </label>
            {createExpense && (
              <>
                <FormField label="Unit cost (GHS)">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="app-field w-full"
                  />
                </FormField>
                <FormField label="Vendor">
                  <input value={vendor} onChange={(e) => setVendor(e.target.value)} className="app-field w-full" />
                </FormField>
              </>
            )}
          </>
        )}
        <FormField label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="app-field w-full" />
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">
          Receive
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

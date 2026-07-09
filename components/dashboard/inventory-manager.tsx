'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Loader2,
  MinusCircle,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { toast } from 'sonner'
import {
  adjustInventoryStock,
  createInventoryItem,
  deleteInventoryItem,
  fetchInventoryMovements,
  issueInventoryStock,
  receiveInventoryStock,
  updateInventoryItem,
} from '@/app/actions/inventory'
import {
  filterInventoryItems,
  sortInventoryItems,
  type InventoryRow,
  type InventorySort,
} from '@/lib/data/inventory'
import { INVENTORY_CATEGORIES } from '@/lib/inventory/categories'
import type { InventoryMovementRow } from '@/lib/inventory/movements'
import {
  inventoryStockStatus,
  buildInventorySummary,
  filterMovements,
  lastReceivedMovement,
  MOVEMENT_REASON_FILTERS,
  STOCK_STATUS_LABEL,
  STOCK_STATUS_PILL,
  stockLevelPercent,
  type MovementReasonFilter,
} from '@/lib/inventory/stock-ui'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { FormField } from '@/components/ui/form-field'

export type InventoryStaffRole = 'owner' | 'manager' | 'receptionist'

interface InventoryManagerProps {
  items: InventoryRow[]
  movements: InventoryMovementRow[]
  staffRole?: InventoryStaffRole
  canCreate?: boolean
  canEditMetadata?: boolean
  canDelete?: boolean
  canRecordExpense?: boolean
  canIssueStock?: boolean
  emphasizeIssue?: boolean
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

const SORT_OPTIONS: { value: InventorySort; label: string }[] = [
  { value: 'low_stock', label: 'Low stock first' },
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
]

const ICON_BTN =
  'inline-flex h-11 min-w-11 items-center justify-center rounded-lg transition-colors duration-150'

export function InventoryManager({
  items,
  movements: initialMovements,
  staffRole = 'manager',
  canCreate = true,
  canEditMetadata = true,
  canDelete = false,
  canRecordExpense = false,
  canIssueStock = true,
  emphasizeIssue = false,
}: InventoryManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<InventoryRow | null>(null)
  const [receiving, setReceiving] = useState<InventoryRow | null>(null)
  const [issuing, setIssuing] = useState<InventoryRow | null>(null)
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const [movements, setMovements] = useState(initialMovements)
  const [movementsLoading, setMovementsLoading] = useState(false)

  const query = searchParams.get('q') ?? ''
  const category = searchParams.get('category') ?? 'all'
  const sort = (searchParams.get('sort') as InventorySort) || 'low_stock'
  const lowStockOnly = searchParams.get('low') === '1'
  const selectedItemId = searchParams.get('item')
  const movementReason = (searchParams.get('reason') as MovementReasonFilter) || 'all'

  useEffect(() => {
    setMovements(initialMovements)
  }, [initialMovements])

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const next = params.toString()
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const setQuery = (value: string) => {
    replaceParams((params) => {
      if (value.trim()) params.set('q', value)
      else params.delete('q')
    })
  }

  const setCategory = (value: string) => {
    replaceParams((params) => {
      if (value !== 'all') params.set('category', value)
      else params.delete('category')
    })
  }

  const setSort = (value: InventorySort) => {
    replaceParams((params) => {
      if (value !== 'low_stock') params.set('sort', value)
      else params.delete('sort')
    })
  }

  const setLowStockOnly = (value: boolean) => {
    replaceParams((params) => {
      if (value) params.set('low', '1')
      else params.delete('low')
    })
  }

  const setSelectedItemId = (id: string | null) => {
    replaceParams((params) => {
      if (id) params.set('item', id)
      else params.delete('item')
    })
  }

  const setMovementReason = (value: MovementReasonFilter) => {
    replaceParams((params) => {
      if (value !== 'all') params.set('reason', value)
      else params.delete('reason')
    })
  }

  useEffect(() => {
    if (!selectedItemId) return
    let cancelled = false
    setMovementsLoading(true)
    void fetchInventoryMovements(selectedItemId).then((result) => {
      if (cancelled) return
      if (result.success && result.data) setMovements(result.data)
      setMovementsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedItemId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filtered = useMemo(() => {
    const list = filterInventoryItems(items, query, category, { lowStockOnly })
    return sortInventoryItems(list, sort)
  }, [items, query, category, sort, lowStockOnly])

  const summary = useMemo(
    () => buildInventorySummary(items, initialMovements),
    [items, initialMovements],
  )

  const lowStock = useMemo(() => items.filter((i) => i.lowStock), [items])
  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null

  const displayedMovements = useMemo(() => {
    const source = selectedItemId ? movements : initialMovements
    return filterMovements(source, { itemId: selectedItemId, reason: movementReason })
  }, [initialMovements, movementReason, movements, selectedItemId])

  function markPending(id: string, active: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (active) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleDelete(item: InventoryRow) {
    markPending(item.id, true)
    startTransition(async () => {
      const result = await deleteInventoryItem(item.id)
      markPending(item.id, false)
      if (result.success) {
        toast.success('Item removed')
        setDeleteTarget(null)
        if (selectedItemId === item.id) setSelectedItemId(null)
      } else {
        toast.error(result.error ?? 'Delete failed')
      }
    })
  }

  const complaintsHref = `/${staffRole}/complaints`
  const housekeepingHref = staffRole === 'receptionist' ? null : `/${staffRole}/housekeeping`

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total SKUs" value={String(summary.totalSkus)} />
        <SummaryCard
          label="Low stock"
          value={String(summary.lowStockCount)}
          emphasis={summary.lowStockCount > 0}
          onClick={() => setLowStockOnly(!lowStockOnly)}
          active={lowStockOnly}
        />
        <SummaryCard
          label="Out of stock"
          value={String(summary.outOfStockCount)}
          emphasis={summary.outOfStockCount > 0}
          onClick={() => {
            setLowStockOnly(true)
            replaceParams((params) => {
              params.set('low', '1')
              params.set('sort', 'low_stock')
            })
          }}
        />
        <SummaryCard label="Moves this week" value={String(summary.movementsThisWeek)} />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">
                  {lowStock.length} item{lowStock.length === 1 ? '' : 's'} at or below reorder
                  level
                </p>
                <ul className="mt-2 space-y-1">
                  {lowStock.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-2">
                      <span>{item.name}</span>
                      <span className="text-xs tabular-nums text-amber-800">
                        ({item.quantityInStock} left)
                      </span>
                      <button
                        type="button"
                        onClick={() => setReceiving(item)}
                        className="text-xs font-semibold underline underline-offset-2 hover:no-underline"
                      >
                        Receive
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`app-btn shrink-0 text-xs ${lowStockOnly ? 'app-btn-primary' : 'app-btn-secondary'}`}
            >
              {lowStockOnly ? 'Show all items' : 'Show low stock only'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="app-search-field min-w-[200px] flex-1">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search items… (press /)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="Search inventory"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as InventorySort)}
            className="app-field"
            aria-label="Sort items"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {canCreate && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="app-btn app-btn-primary inline-flex h-11 items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add item
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={category === 'all'} onClick={() => setCategory('all')}>
            All
          </FilterPill>
          {INVENTORY_CATEGORIES.map((c) => (
            <FilterPill
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </FilterPill>
          ))}
          <FilterPill active={lowStockOnly} onClick={() => setLowStockOnly(!lowStockOnly)}>
            Low stock
          </FilterPill>
        </div>

        {items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {items.length} item{items.length === 1 ? '' : 's'}
            {selectedItem ? ` · ${selectedItem.name} selected` : ''}
          </p>
        )}
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
                : lowStockOnly
                  ? 'No items are currently at or below reorder level.'
                  : 'Try a different search or category filter.'
            }
            action={
              items.length === 0 && canCreate ? (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="app-btn app-btn-primary inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add first item
                </button>
              ) : lowStockOnly ? (
                <button
                  type="button"
                  onClick={() => setLowStockOnly(false)}
                  className="app-btn app-btn-secondary"
                >
                  Show all items
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
                  selected={selectedItemId === item.id}
                  pending={pendingIds.has(item.id) || pending}
                  canDelete={canDelete}
                  canEditMetadata={canEditMetadata}
                  canIssueStock={canIssueStock}
                  emphasizeIssue={emphasizeIssue}
                  onSelect={() =>
                    setSelectedItemId(selectedItemId === item.id ? null : item.id)
                  }
                  onEdit={() => setEditing(item)}
                  onReceive={() => setReceiving(item)}
                  onIssue={() => setIssuing(item)}
                  onAdjust={() => setAdjusting(item)}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <div className="data-table-wrap px-4 pb-4 pt-2">
                <table className="data-table w-full min-w-[880px]">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Stock level</th>
                      <th>Status</th>
                      <th>Unit</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <InventoryTableRow
                        key={item.id}
                        item={item}
                        selected={selectedItemId === item.id}
                        pending={pendingIds.has(item.id) || pending}
                        canDelete={canDelete}
                        canEditMetadata={canEditMetadata}
                        canIssueStock={canIssueStock}
                        emphasizeIssue={emphasizeIssue}
                        onSelect={() =>
                          setSelectedItemId(selectedItemId === item.id ? null : item.id)
                        }
                        onEdit={() => setEditing(item)}
                        onReceive={() => setReceiving(item)}
                        onIssue={() => setIssuing(item)}
                        onAdjust={() => setAdjusting(item)}
                        onDelete={() => setDeleteTarget(item)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <section className="surface-card overflow-hidden">
        <div className="surface-card-header flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[var(--comp-sand)]" aria-hidden />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Movement history</h3>
              <p className="text-sm text-muted-foreground">
                {selectedItem
                  ? `Showing changes for ${selectedItem.name}`
                  : 'Who changed stock and why'}
              </p>
            </div>
          </div>
          {selectedItemId && (
            <button
              type="button"
              onClick={() => {
                setSelectedItemId(null)
                setMovements(initialMovements)
              }}
              className="app-btn app-btn-ghost text-xs"
            >
              Clear item filter
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {MOVEMENT_REASON_FILTERS.map((reason) => (
            <FilterPill
              key={reason}
              active={movementReason === reason}
              onClick={() => setMovementReason(reason)}
            >
              {reason === 'all' ? 'All reasons' : (REASON_LABELS[reason] ?? reason)}
            </FilterPill>
          ))}
        </div>

        {movementsLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading movements…
          </div>
        ) : displayedMovements.length === 0 ? (
          <DataEmptyState
            borderless
            icon={History}
            title="No movements yet"
            message={
              selectedItem
                ? 'No stock changes recorded for this item with the current filters.'
                : 'Receive stock or issue supplies to start the audit log.'
            }
          />
        ) : (
          <div className="list-stack max-h-96 overflow-y-auto">
            {displayedMovements.map((m) => (
              <MovementRow
                key={m.id}
                movement={m}
                complaintsHref={complaintsHref}
                housekeepingHref={housekeepingHref}
              />
            ))}
          </div>
        )}
      </section>

      {creating && <ItemFormModal title="Add inventory item" onClose={() => setCreating(false)} />}
      {editing && (
        <ItemFormModal
          title="Edit item"
          item={editing}
          onClose={() => setEditing(null)}
          onAdjust={() => {
            setAdjusting(editing)
          }}
          canEditMetadata={canEditMetadata}
        />
      )}
      {receiving && (
        <ReceiveStockModal
          item={receiving}
          movements={initialMovements}
          canRecordExpense={canRecordExpense}
          onClose={() => setReceiving(null)}
        />
      )}
      {issuing && canIssueStock && (
        <IssueStockModal item={issuing} onClose={() => setIssuing(null)} />
      )}
      {adjusting && canEditMetadata && (
        <AdjustStockModal item={adjusting} onClose={() => setAdjusting(null)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget}
          pending={pending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  emphasis = false,
  active = false,
  onClick,
}: {
  label: string
  value: string
  emphasis?: boolean
  active?: boolean
  onClick?: () => void
}) {
  const className = `surface-card p-4 text-left transition-colors duration-150 ${
    onClick ? 'cursor-pointer hover:bg-secondary/40' : ''
  } ${active ? 'ring-2 ring-primary/30' : ''} ${emphasis ? 'border-amber-200 bg-amber-50/50' : ''}`

  const inner = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${emphasis ? 'text-amber-900' : 'text-foreground'}`}>
        {value}
      </p>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    )
  }

  return <div className={className}>{inner}</div>
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

function StockLevelBar({ item }: { item: InventoryRow }) {
  const percent = stockLevelPercent(item)
  const tone =
    item.quantityInStock === 0 ? 'bg-destructive' : item.lowStock ? 'bg-amber-500' : 'bg-emerald-600'

  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums text-foreground">{item.quantityInStock}</span>
        <span className="text-muted-foreground tabular-nums">/ {item.reorderLevel} reorder</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={item.quantityInStock}
        aria-valuemin={0}
        aria-valuemax={Math.max(item.reorderLevel, item.quantityInStock, 1)}
        aria-label={`${item.name} stock level`}
      >
        <div className={`h-full rounded-full transition-[width] duration-300 ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function StockStatusBadge({ item }: { item: InventoryRow }) {
  const status = inventoryStockStatus(item)
  return <span className={STOCK_STATUS_PILL[status]}>{STOCK_STATUS_LABEL[status]}</span>
}

function ItemActions({
  item,
  pending,
  canDelete,
  canEditMetadata,
  canIssueStock,
  emphasizeIssue,
  onEdit,
  onReceive,
  onIssue,
  onAdjust,
  onDelete,
  compact,
}: {
  item: InventoryRow
  pending: boolean
  canDelete: boolean
  canEditMetadata: boolean
  canIssueStock: boolean
  emphasizeIssue: boolean
  onEdit: () => void
  onReceive: () => void
  onIssue: () => void
  onAdjust: () => void
  onDelete: () => void
  compact?: boolean
}) {
  const receiveBtn = (
    <button
      type="button"
      onClick={onReceive}
      disabled={pending}
      className={
        compact
          ? 'app-btn app-btn-secondary inline-flex h-11 items-center gap-1.5 px-3 text-xs'
          : `${ICON_BTN} gap-1 px-3 text-xs font-semibold text-primary hover:bg-primary/10`
      }
    >
      <ArrowDownCircle className="h-4 w-4" aria-hidden />
      Receive
    </button>
  )

  const issueBtn = canIssueStock ? (
    <button
      type="button"
      onClick={onIssue}
      disabled={pending}
      className={
        compact
          ? `app-btn inline-flex h-11 items-center gap-1.5 px-3 text-xs ${
              emphasizeIssue ? 'app-btn-primary' : 'app-btn-ghost'
            }`
          : `${ICON_BTN} gap-1 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100`
      }
    >
      <ArrowUpCircle className="h-4 w-4" aria-hidden />
      Issue
    </button>
  ) : null

  const adjustBtn = canEditMetadata ? (
    <button
      type="button"
      onClick={onAdjust}
      disabled={pending}
      className={
        compact
          ? 'app-btn app-btn-ghost inline-flex h-11 items-center gap-1.5 px-3 text-xs'
          : `${ICON_BTN} gap-1 px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary`
      }
      aria-label="Adjust stock"
    >
      <MinusCircle className="h-4 w-4" />
      {!compact && 'Adjust'}
    </button>
  ) : null

  const editBtn = canEditMetadata ? (
    <button
      type="button"
      onClick={onEdit}
      disabled={pending}
      className={`${ICON_BTN} text-muted-foreground hover:bg-secondary`}
      aria-label="Edit item details"
    >
      <Pencil className="h-4 w-4" />
    </button>
  ) : null

  const deleteBtn = canDelete ? (
    <button
      type="button"
      disabled={pending}
      onClick={onDelete}
      className={`${ICON_BTN} text-muted-foreground hover:bg-destructive/10 hover:text-destructive`}
      aria-label="Delete item"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ) : null

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {emphasizeIssue ? (
          <>
            {issueBtn}
            {receiveBtn}
          </>
        ) : (
          <>
            {receiveBtn}
            {issueBtn}
          </>
        )}
        {adjustBtn}
        {canEditMetadata && (
          <button type="button" onClick={onEdit} className="app-btn app-btn-ghost h-11 text-xs">
            Edit details
          </button>
        )}
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
    )
  }

  return (
    <div className="flex justify-end gap-1">
      {emphasizeIssue ? (
        <>
          {issueBtn}
          {receiveBtn}
        </>
      ) : (
        <>
          {receiveBtn}
          {issueBtn}
        </>
      )}
      {adjustBtn}
      {editBtn}
      {deleteBtn}
    </div>
  )
}

function InventoryTableRow({
  item,
  selected,
  pending,
  canDelete,
  canEditMetadata,
  canIssueStock,
  emphasizeIssue,
  onSelect,
  onEdit,
  onReceive,
  onIssue,
  onAdjust,
  onDelete,
}: {
  item: InventoryRow
  selected: boolean
  pending: boolean
  canDelete: boolean
  canEditMetadata: boolean
  canIssueStock: boolean
  emphasizeIssue: boolean
  onSelect: () => void
  onEdit: () => void
  onReceive: () => void
  onIssue: () => void
  onAdjust: () => void
  onDelete: () => void
}) {
  return (
    <tr
      className={`cursor-pointer transition-colors duration-150 ${
        selected ? 'bg-primary/5' : item.lowStock ? 'bg-amber-50/40' : undefined
      } ${pending ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <td>
        <p className="font-medium">{item.name}</p>
        {item.notes && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.notes}</p>
        )}
      </td>
      <td className="text-muted-foreground">{item.categoryLabel}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <StockLevelBar item={item} />
      </td>
      <td>
        <StockStatusBadge item={item} />
      </td>
      <td className="text-muted-foreground">{item.unit}</td>
      <td onClick={(e) => e.stopPropagation()}>
        <ItemActions
          item={item}
          pending={pending}
          canDelete={canDelete}
          canEditMetadata={canEditMetadata}
          canIssueStock={canIssueStock}
          emphasizeIssue={emphasizeIssue}
          onEdit={onEdit}
          onReceive={onReceive}
          onIssue={onIssue}
          onAdjust={onAdjust}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

function InventoryCard({
  item,
  selected,
  pending,
  canDelete,
  canEditMetadata,
  canIssueStock,
  emphasizeIssue,
  onSelect,
  onEdit,
  onReceive,
  onIssue,
  onAdjust,
  onDelete,
}: {
  item: InventoryRow
  selected: boolean
  pending: boolean
  canDelete: boolean
  canEditMetadata: boolean
  canIssueStock: boolean
  emphasizeIssue: boolean
  onSelect: () => void
  onEdit: () => void
  onReceive: () => void
  onIssue: () => void
  onAdjust: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`elevated-list-item p-4 transition-opacity duration-150 ${
        selected ? 'ring-2 ring-primary/30' : item.lowStock ? 'ring-1 ring-amber-200' : ''
      } ${pending ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{item.name}</p>
            <StockStatusBadge item={item} />
          </div>
          <p className="text-sm text-muted-foreground">{item.categoryLabel}</p>
          {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
          <div className="mt-3">
            <StockLevelBar item={item} />
          </div>
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
        <ItemActions
          item={item}
          pending={pending}
          canDelete={canDelete}
          canEditMetadata={canEditMetadata}
          canIssueStock={canIssueStock}
          emphasizeIssue={emphasizeIssue}
          onEdit={onEdit}
          onReceive={onReceive}
          onIssue={onIssue}
          onAdjust={onAdjust}
          onDelete={onDelete}
          compact
        />
      </div>
    </div>
  )
}

function MovementRow({
  movement: m,
  complaintsHref,
  housekeepingHref,
}: {
  movement: InventoryMovementRow
  complaintsHref: string
  housekeepingHref: string | null
}) {
  return (
    <div className="list-row flex-wrap items-center justify-between gap-2">
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
        {(m.complaintId || m.housekeepingTaskId) && (
          <p className="mt-1 flex flex-wrap gap-2 text-xs">
            {m.complaintId && (
              <Link href={complaintsHref} className="font-semibold text-primary hover:underline">
                View complaint
              </Link>
            )}
            {m.housekeepingTaskId && housekeepingHref && (
              <Link href={housekeepingHref} className="font-semibold text-primary hover:underline">
                View housekeeping
              </Link>
            )}
          </p>
        )}
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        → {m.quantityAfter} in stock
      </span>
    </div>
  )
}

function ItemFormModal({
  title,
  item,
  onClose,
  onAdjust,
  canEditMetadata = true,
}: {
  title: string
  item?: InventoryRow
  onClose: () => void
  onAdjust?: () => void
  canEditMetadata?: boolean
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
      try {
        const result = item
          ? await updateInventoryItem(item.id, {
              name,
              category,
              reorderLevel: Number(reorderLevel),
              unit,
              notes: notes || undefined,
            })
          : await createInventoryItem({
              name,
              category,
              quantityInStock: Number(quantityInStock),
              reorderLevel: Number(reorderLevel),
              unit,
              notes: notes || undefined,
            })
        if (result.success) {
          toast.success(item ? 'Item updated' : 'Item added')
          onClose()
        } else {
          setError(result.error ?? 'Could not save item')
          toast.error(result.error ?? 'Could not save item')
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save item.'
        setError(message)
        toast.error(message)
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="app-field w-full"
            disabled={!canEditMetadata}
          />
        </FormField>
        <FormField label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="app-field w-full"
            disabled={!canEditMetadata}
          >
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        {item ? (
          <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3">
            <p className="text-xs font-medium text-muted-foreground">Current stock</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {item.quantityInStock} {item.unit}
            </p>
            {onAdjust && canEditMetadata && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onAdjust()
                }}
                className="mt-2 text-xs font-semibold text-primary hover:underline"
              >
                Adjust stock with reason →
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Opening stock">
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
        )}
        {item && (
          <FormField label="Reorder at">
            <input
              type="number"
              min={0}
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              className="app-field w-full"
              disabled={!canEditMetadata}
            />
          </FormField>
        )}
        <FormField label="Unit">
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="app-field w-full"
            disabled={!canEditMetadata}
          />
        </FormField>
        <FormField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="app-field w-full"
            disabled={!canEditMetadata}
          />
        </FormField>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        {canEditMetadata && (
          <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">
            Save
          </button>
        )}
      </ModalFooter>
    </CenteredModal>
  )
}

function ReceiveStockModal({
  item,
  movements,
  canRecordExpense,
  onClose,
}: {
  item: InventoryRow
  movements: InventoryMovementRow[]
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

  const qtyNum = Math.max(0, Number(quantity) || 0)
  const projected = item.quantityInStock + qtyNum
  const lastReceived = lastReceivedMovement(movements, item.id)

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
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 text-sm">
          <p className="text-muted-foreground">
            After receive:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {item.quantityInStock} → {projected} {item.unit}
            </span>
          </p>
          {lastReceived && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last received{' '}
              {new Date(lastReceived.createdAt).toLocaleDateString('en-GB', {
                month: 'short',
                day: 'numeric',
              })}
              {lastReceived.note ? ` · ${lastReceived.note}` : ''}
            </p>
          )}
        </div>
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
                  <input
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    className="app-field w-full"
                  />
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

function IssueStockModal({ item, onClose }: { item: InventoryRow; onClose: () => void }) {
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const qtyNum = Math.max(0, Number(quantity) || 0)
  const projected = Math.max(0, item.quantityInStock - qtyNum)

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await issueInventoryStock({
        itemId: item.id,
        quantity: Number(quantity),
        note: note || undefined,
      })
      if (result.success) {
        toast.success('Stock issued')
        onClose()
      } else {
        setError(result.error ?? 'Could not issue stock')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Issue stock">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Issue stock</h3>
        <p className="text-sm text-muted-foreground">{item.name}</p>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 text-sm">
          <p className="text-muted-foreground">
            After issue:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {item.quantityInStock} → {projected} {item.unit}
            </span>
          </p>
        </div>
        <FormField label="Quantity issued">
          <input
            type="number"
            min={1}
            max={item.quantityInStock}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="app-field w-full"
          />
        </FormField>
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
          Issue
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

function AdjustStockModal({ item, onClose }: { item: InventoryRow; onClose: () => void }) {
  const [newQuantity, setNewQuantity] = useState(String(item.quantityInStock))
  const [reason, setReason] = useState<'adjusted' | 'wasted'>('adjusted')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await adjustInventoryStock({
        itemId: item.id,
        newQuantity: Number(newQuantity),
        reason,
        note: note || undefined,
      })
      if (result.success) {
        toast.success('Stock adjusted')
        onClose()
      } else {
        setError(result.error ?? 'Could not adjust stock')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Adjust stock">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Adjust stock</h3>
        <p className="text-sm text-muted-foreground">{item.name}</p>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-3 text-sm">
          <p className="text-muted-foreground">
            Change:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {item.quantityInStock} → {newQuantity} {item.unit}
            </span>
          </p>
        </div>
        <FormField label="New quantity">
          <input
            type="number"
            min={0}
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            className="app-field w-full"
          />
        </FormField>
        <FormField label="Reason">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as 'adjusted' | 'wasted')}
            className="app-field w-full"
          >
            <option value="adjusted">Count adjustment</option>
            <option value="wasted">Wasted / spoiled</option>
          </select>
        </FormField>
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
          Save adjustment
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

function DeleteConfirmModal({
  item,
  pending,
  onClose,
  onConfirm,
}: {
  item: InventoryRow
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <CenteredModal open onClose={onClose} className="max-w-sm" aria-label="Confirm delete">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Remove item?</h3>
      </ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{item.name}</span> will be removed from
          inventory. Movement history for this item is kept.
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="app-btn bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Remove
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

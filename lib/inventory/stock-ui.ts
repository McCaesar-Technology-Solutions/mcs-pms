import type { InventoryRow } from '@/lib/data/inventory'
import type { InventoryMovementRow } from '@/lib/inventory/movements'

export type InventoryStockStatus = 'ok' | 'low' | 'out'

export function inventoryStockStatus(
  item: Pick<InventoryRow, 'quantityInStock' | 'lowStock'>,
): InventoryStockStatus {
  if (item.quantityInStock === 0) return 'out'
  if (item.lowStock) return 'low'
  return 'ok'
}

export function stockLevelPercent(
  item: Pick<InventoryRow, 'quantityInStock' | 'reorderLevel'>,
): number {
  if (item.reorderLevel <= 0) {
    return item.quantityInStock > 0 ? 100 : 0
  }
  return Math.min(100, Math.round((item.quantityInStock / item.reorderLevel) * 100))
}

export const INVENTORY_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function inventoryWeekStart(now = Date.now()): Date {
  return new Date(now - INVENTORY_WEEK_MS)
}

export interface InventorySummary {
  totalSkus: number
  lowStockCount: number
  outOfStockCount: number
  movementsThisWeek: number
}

export function buildInventorySummary(
  items: InventoryRow[],
  movementsThisWeek: number,
): InventorySummary {
  return {
    totalSkus: items.length,
    lowStockCount: items.filter((i) => i.lowStock && i.quantityInStock > 0).length,
    outOfStockCount: items.filter((i) => i.quantityInStock === 0).length,
    movementsThisWeek,
  }
}

export function lastReceivedMovement(
  movements: InventoryMovementRow[],
  itemId: string,
): InventoryMovementRow | null {
  return (
    movements.find((m) => m.itemId === itemId && m.reason === 'received' && m.delta > 0) ??
    null
  )
}

export const STOCK_STATUS_LABEL: Record<InventoryStockStatus, string> = {
  ok: 'OK',
  low: 'Low',
  out: 'Out',
}

export const STOCK_STATUS_PILL: Record<InventoryStockStatus, string> = {
  ok: 'status-pill status-pill--success',
  low: 'status-pill status-pill--warm',
  out: 'status-pill status-pill--coral',
}

export const MOVEMENT_REASON_FILTERS = [
  'all',
  'received',
  'used',
  'clean',
  'restock',
  'adjusted',
  'wasted',
  'maintenance',
] as const

export type MovementReasonFilter = (typeof MOVEMENT_REASON_FILTERS)[number]

export function filterMovements(
  movements: InventoryMovementRow[],
  options: { itemId?: string | null; reason?: MovementReasonFilter },
): InventoryMovementRow[] {
  return movements.filter((m) => {
    if (options.itemId && m.itemId !== options.itemId) return false
    if (options.reason && options.reason !== 'all' && m.reason !== options.reason) return false
    return true
  })
}

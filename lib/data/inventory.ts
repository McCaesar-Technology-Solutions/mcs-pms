import { createAdminClient } from '@/lib/supabase/admin'
import { inventoryCategoryLabel } from '@/lib/inventory/categories'
import { loadInventoryMovements, type InventoryMovementRow } from '@/lib/inventory/movements'

export interface InventoryRow {
  id: string
  name: string
  category: string
  categoryLabel: string
  quantityInStock: number
  reorderLevel: number
  unit: string
  notes: string | null
  lowStock: boolean
  updatedAt: string | null
}

export type InventorySort = 'name' | 'low_stock' | 'category'

export async function loadInventoryItems(hotelId: string): Promise<InventoryRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('inventory_items')
    .select('id, name, category, quantity_in_stock, reorder_level, unit, notes, updated_at')
    .eq('hotel_id', hotelId)
    .order('name')

  return (data ?? []).map(mapInventoryRow)
}

export function sortInventoryItems(items: InventoryRow[], sort: InventorySort): InventoryRow[] {
  const copy = [...items]
  if (sort === 'low_stock') {
    return copy.sort((a, b) => {
      if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }
  if (sort === 'category') {
    return copy.sort(
      (a, b) =>
        a.categoryLabel.localeCompare(b.categoryLabel) || a.name.localeCompare(b.name),
    )
  }
  return copy.sort((a, b) => a.name.localeCompare(b.name))
}

export interface InventoryFilterOptions {
  lowStockOnly?: boolean
}

export function filterInventoryItems(
  items: InventoryRow[],
  query: string,
  category: string,
  options?: InventoryFilterOptions,
): InventoryRow[] {
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    if (options?.lowStockOnly && !item.lowStock) return false
    if (category !== 'all' && item.category !== category) return false
    if (!q) return true
    return (
      item.name.toLowerCase().includes(q) ||
      item.categoryLabel.toLowerCase().includes(q) ||
      (item.notes?.toLowerCase().includes(q) ?? false)
    )
  })
}

export function countLowStockItems(items: InventoryRow[]): number {
  return items.filter((i) => i.lowStock).length
}

export async function countLowStockForHotel(hotelId: string): Promise<number> {
  const items = await loadInventoryItems(hotelId)
  return countLowStockItems(items)
}

export async function loadRecentInventoryMovements(
  hotelId: string,
  itemId?: string,
): Promise<InventoryMovementRow[]> {
  const admin = createAdminClient()
  return loadInventoryMovements(admin, hotelId, { itemId, limit: itemId ? 30 : 20 })
}

function mapInventoryRow(row: {
  id: string
  name: string
  category: string
  quantity_in_stock: number
  reorder_level: number
  unit: string
  notes: string | null
  updated_at: string | null
}): InventoryRow {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    categoryLabel: inventoryCategoryLabel(row.category),
    quantityInStock: row.quantity_in_stock,
    reorderLevel: row.reorder_level,
    unit: row.unit,
    notes: row.notes,
    lowStock: row.quantity_in_stock <= row.reorder_level,
    updatedAt: row.updated_at,
  }
}

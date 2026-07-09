import { tryCreateAdminClient } from '@/lib/supabase/admin'
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
  try {
    const admin = tryCreateAdminClient()
    if (!admin) return []
    const { data, error } = await admin
      .from('inventory_items')
      .select('id, name, category, quantity_in_stock, reorder_level, unit, notes, updated_at')
      .eq('hotel_id', hotelId)
      .order('name')

    if (error) {
      console.error('[inventory] loadInventoryItems failed:', error.message)
      return []
    }

    return (data ?? []).map(mapInventoryRow)
  } catch (err) {
    console.error('[inventory] loadInventoryItems failed:', err)
    return []
  }
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
  try {
    const admin = tryCreateAdminClient()
    if (!admin) return []
    const { data: items, error: itemsError } = await admin
      .from('inventory_items')
      .select('id, name')
      .eq('hotel_id', hotelId)

    if (itemsError) {
      console.error('[inventory] loadRecentInventoryMovements items failed:', itemsError.message)
    }

    const itemNames = new Map((items ?? []).map((item) => [item.id, item.name]))
    return loadInventoryMovements(admin, hotelId, {
      itemId,
      limit: itemId ? 30 : 20,
      itemNames,
    })
  } catch (err) {
    console.error('[inventory] loadRecentInventoryMovements failed:', err)
    return []
  }
}

function mapInventoryRow(row: {
  id: string
  name: string
  category: string | null
  quantity_in_stock: number | null
  reorder_level: number | null
  unit: string | null
  notes: string | null
  updated_at: string | null
}): InventoryRow {
  const category = row.category ?? 'general'
  const quantityInStock = row.quantity_in_stock ?? 0
  const reorderLevel = row.reorder_level ?? 0
  return {
    id: row.id,
    name: row.name,
    category,
    categoryLabel: inventoryCategoryLabel(category),
    quantityInStock,
    reorderLevel,
    unit: row.unit ?? 'unit',
    notes: row.notes,
    lowStock: quantityInStock <= reorderLevel,
    updatedAt: row.updated_at,
  }
}

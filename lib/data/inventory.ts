import { createAdminClient } from '@/lib/supabase/admin'

export interface InventoryRow {
  id: string
  name: string
  category: string
  quantityInStock: number
  reorderLevel: number
  unit: string
  notes: string | null
  lowStock: boolean
}

export async function loadInventoryItems(hotelId: string): Promise<InventoryRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('inventory_items')
    .select('id, name, category, quantity_in_stock, reorder_level, unit, notes')
    .eq('hotel_id', hotelId)
    .order('name')

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    quantityInStock: row.quantity_in_stock,
    reorderLevel: row.reorder_level,
    unit: row.unit,
    notes: row.notes,
    lowStock: row.quantity_in_stock <= row.reorder_level,
  }))
}

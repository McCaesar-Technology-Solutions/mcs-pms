export const INVENTORY_CATEGORIES = [
  { id: 'linens', label: 'Linens' },
  { id: 'toiletries', label: 'Toiletries' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'minibar', label: 'Minibar' },
  { id: 'cleaning', label: 'Cleaning supplies' },
  { id: 'general', label: 'General' },
] as const

export type InventoryCategoryId = (typeof INVENTORY_CATEGORIES)[number]['id']

export function inventoryCategoryLabel(id: string): string {
  return INVENTORY_CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/_/g, ' ')
}

export function normalizeInventoryCategory(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const match = INVENTORY_CATEGORIES.find((c) => c.id === trimmed || c.label.toLowerCase() === trimmed)
  return match?.id ?? (trimmed.slice(0, 60) || 'general')
}

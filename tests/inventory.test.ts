import { describe, expect, it } from 'vitest'
import { inventoryCategoryLabel, normalizeInventoryCategory } from '@/lib/inventory/categories'
import { suggestCleanConsumption } from '@/lib/inventory/clean-consumption'
import { filterInventoryItems, sortInventoryItems } from '@/lib/data/inventory'
import type { InventoryRow } from '@/lib/data/inventory'

const sampleItems: InventoryRow[] = [
  {
    id: '1',
    name: 'Bath towel',
    category: 'linens',
    categoryLabel: 'Linens',
    quantityInStock: 2,
    reorderLevel: 5,
    unit: 'piece',
    notes: null,
    lowStock: true,
    updatedAt: null,
  },
  {
    id: '2',
    name: 'Hand soap',
    category: 'toiletries',
    categoryLabel: 'Toiletries',
    quantityInStock: 20,
    reorderLevel: 10,
    unit: 'bottle',
    notes: 'Guest rooms',
    lowStock: false,
    updatedAt: null,
  },
]

describe('inventory categories', () => {
  it('normalizes known category labels', () => {
    expect(normalizeInventoryCategory('Linens')).toBe('linens')
    expect(inventoryCategoryLabel('linens')).toBe('Linens')
  })
})

describe('inventory list helpers', () => {
  it('filters by category and search query', () => {
    const filtered = filterInventoryItems(sampleItems, 'towel', 'all')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.name).toBe('Bath towel')
  })

  it('sorts low stock first', () => {
    const sorted = sortInventoryItems(sampleItems, 'low_stock')
    expect(sorted[0]?.lowStock).toBe(true)
  })
})

describe('clean consumption suggestions', () => {
  it('matches inventory items by name fragment', () => {
    const suggestions = suggestCleanConsumption([
      { id: '1', name: 'Bath towel set' },
      { id: '2', name: 'Liquid hand soap' },
    ])
    expect(suggestions.some((s) => s.itemId === '1')).toBe(true)
    expect(suggestions.some((s) => s.itemId === '2')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { inventoryCategoryLabel, normalizeInventoryCategory } from '@/lib/inventory/categories'
import { suggestCleanConsumption } from '@/lib/inventory/clean-consumption'
import { filterInventoryItems, sortInventoryItems } from '@/lib/data/inventory'
import type { InventoryRow } from '@/lib/data/inventory'
import {
  buildInventorySummary,
  inventoryStockStatus,
  stockLevelPercent,
} from '@/lib/inventory/stock-ui'
import {
  filterMovementsForDisplay,
  groupMovementsByDay,
} from '@/lib/inventory/movement-ui'

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

  it('filters low stock only', () => {
    const filtered = filterInventoryItems(sampleItems, '', 'all', { lowStockOnly: true })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.name).toBe('Bath towel')
  })

  it('sorts low stock first', () => {
    const sorted = sortInventoryItems(sampleItems, 'low_stock')
    expect(sorted[0]?.lowStock).toBe(true)
  })
})

describe('inventory stock ui', () => {
  it('computes summary counts', () => {
    const summary = buildInventorySummary(sampleItems, 1)
    expect(summary.totalSkus).toBe(2)
    expect(summary.lowStockCount).toBe(1)
    expect(summary.movementsThisWeek).toBe(1)
  })

  it('derives stock status and percent', () => {
    expect(inventoryStockStatus(sampleItems[0]!)).toBe('low')
    expect(stockLevelPercent(sampleItems[0]!)).toBe(40)
    expect(inventoryStockStatus({ quantityInStock: 0, lowStock: true })).toBe('out')
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

describe('inventory movement ui', () => {
  const now = new Date('2026-07-11T12:00:00.000Z').getTime()
  const movements = [
    {
      id: 'm1',
      itemId: '1',
      itemName: 'Towel',
      delta: 5,
      quantityAfter: 10,
      reason: 'received' as const,
      note: null,
      createdByName: 'Sam',
      createdAt: '2026-07-11T10:00:00.000Z',
      housekeepingTaskId: null,
      complaintId: null,
    },
    {
      id: 'm2',
      itemId: '1',
      itemName: 'Towel',
      delta: -2,
      quantityAfter: 8,
      reason: 'used' as const,
      note: 'Front desk',
      createdByName: null,
      createdAt: '2026-07-10T10:00:00.000Z',
      housekeepingTaskId: null,
      complaintId: null,
    },
  ]

  it('groups movements by day with today and yesterday labels', () => {
    const groups = groupMovementsByDay(movements, now)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.label).toBe('Today')
    expect(groups[1]?.label).toBe('Yesterday')
  })

  it('filters by direction and reason', () => {
    expect(
      filterMovementsForDisplay(movements, { direction: 'in' }).map((m) => m.id),
    ).toEqual(['m1'])
    expect(
      filterMovementsForDisplay(movements, { reason: 'used' }).map((m) => m.id),
    ).toEqual(['m2'])
  })
})

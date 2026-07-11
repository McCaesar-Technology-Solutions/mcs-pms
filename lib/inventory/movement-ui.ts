import type { InventoryMovementRow, InventoryMovementReason } from '@/lib/inventory/movements'
import type { MovementReasonFilter } from '@/lib/inventory/stock-ui'

export type MovementDirectionFilter = 'all' | 'in' | 'out'

export interface MovementReasonMeta {
  label: string
  pillClass: string
  iconWellClass: string
  direction: 'in' | 'out' | 'neutral'
}

export const MOVEMENT_REASON_META: Record<InventoryMovementReason, MovementReasonMeta> = {
  received: {
    label: 'Received',
    pillClass: 'status-pill status-pill--success',
    iconWellClass: 'icon-well icon-well--sage',
    direction: 'in',
  },
  used: {
    label: 'Used',
    pillClass: 'status-pill status-pill--warm',
    iconWellClass: 'icon-well icon-well--sand',
    direction: 'out',
  },
  adjusted: {
    label: 'Adjusted',
    pillClass: 'status-pill status-pill--neutral',
    iconWellClass: 'icon-well icon-well--slate',
    direction: 'neutral',
  },
  wasted: {
    label: 'Wasted',
    pillClass: 'status-pill status-pill--coral',
    iconWellClass: 'icon-well icon-well--coral',
    direction: 'out',
  },
  restock: {
    label: 'Room restock',
    pillClass: 'status-pill status-pill--teal',
    iconWellClass: 'icon-well icon-well--teal',
    direction: 'out',
  },
  clean: {
    label: 'Turnover clean',
    pillClass: 'status-pill status-pill--info',
    iconWellClass: 'icon-well icon-well--sky',
    direction: 'out',
  },
  maintenance: {
    label: 'Maintenance',
    pillClass: 'status-pill status-pill--warm',
    iconWellClass: 'icon-well icon-well--coral',
    direction: 'out',
  },
}

export function movementReasonMeta(reason: InventoryMovementReason): MovementReasonMeta {
  return MOVEMENT_REASON_META[reason] ?? MOVEMENT_REASON_META.adjusted
}

export function filterMovementsForDisplay(
  movements: InventoryMovementRow[],
  options: {
    itemId?: string | null
    reason?: MovementReasonFilter
    direction?: MovementDirectionFilter
  },
): InventoryMovementRow[] {
  return movements.filter((m) => {
    if (options.itemId && m.itemId !== options.itemId) return false
    if (options.reason && options.reason !== 'all' && m.reason !== options.reason) return false
    if (options.direction === 'in' && m.delta <= 0) return false
    if (options.direction === 'out' && m.delta >= 0) return false
    return true
  })
}

export function countMovementsByReason(
  movements: InventoryMovementRow[],
  options?: { itemId?: string | null; direction?: MovementDirectionFilter },
): Partial<Record<MovementReasonFilter, number>> {
  const base = filterMovementsForDisplay(movements, {
    itemId: options?.itemId,
    direction: options?.direction,
    reason: 'all',
  })
  const counts: Partial<Record<MovementReasonFilter, number>> = { all: base.length }
  for (const m of base) {
    counts[m.reason] = (counts[m.reason] ?? 0) + 1
  }
  return counts
}

export interface MovementDayGroup {
  key: string
  label: string
  items: InventoryMovementRow[]
}

export function groupMovementsByDay(
  movements: InventoryMovementRow[],
  now = Date.now(),
): MovementDayGroup[] {
  const order: string[] = []
  const byDay = new Map<string, InventoryMovementRow[]>()

  for (const movement of movements) {
    const key = movement.createdAt.slice(0, 10)
    if (!byDay.has(key)) {
      byDay.set(key, [])
      order.push(key)
    }
    byDay.get(key)!.push(movement)
  }

  return order.map((key) => ({
    key,
    label: formatMovementDayLabel(key, now),
    items: byDay.get(key) ?? [],
  }))
}

export function formatMovementDayLabel(dayKey: string, now = Date.now()): string {
  const today = new Date(now).toISOString().slice(0, 10)
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10)
  if (dayKey === today) return 'Today'
  if (dayKey === yesterday) return 'Yesterday'
  const date = new Date(`${dayKey}T12:00:00.000Z`)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatMovementWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatMovementRelative(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime()
  const diffMs = now - then
  if (diffMs < 0) return formatMovementWhen(iso)

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return formatMovementWhen(iso)
}

export function movementDeltaLabel(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta)
}

export function movementDeltaTone(delta: number): string {
  if (delta > 0) return 'text-emerald-700 bg-emerald-50 ring-emerald-200/80'
  if (delta < 0) return 'text-amber-900 bg-amber-50 ring-amber-200/80'
  return 'text-muted-foreground bg-secondary ring-border'
}

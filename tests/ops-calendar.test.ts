import { describe, expect, it } from 'vitest'
import {
  formatOpsEventWhen,
  isImportantOpsCategory,
  OPS_EVENT_LABELS,
} from '@/lib/ops-calendar/categories'

describe('ops calendar categories', () => {
  it('marks operational categories as important for team chat', () => {
    expect(isImportantOpsCategory('maintenance')).toBe(true)
    expect(isImportantOpsCategory('meeting')).toBe(true)
    expect(isImportantOpsCategory('general')).toBe(false)
  })

  it('formats event times for notifications', () => {
    const formatted = formatOpsEventWhen('2026-07-08T14:00:00.000Z', false)
    expect(formatted.length).toBeGreaterThan(5)
    expect(OPS_EVENT_LABELS.maintenance).toBe('Maintenance')
  })
})

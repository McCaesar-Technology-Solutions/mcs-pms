import { describe, expect, it } from 'vitest'
import { computeComplaintSlaDueAt, isComplaintSlaBreached } from '@/lib/complaints/sla'

describe('complaint SLA', () => {
  it('sets urgent SLA to 4 hours', () => {
    const base = new Date('2026-06-15T12:00:00Z')
    const due = computeComplaintSlaDueAt('urgent', base)
    expect(due).toBe('2026-06-15T16:00:00.000Z')
  })

  it('detects breached SLA for open complaints', () => {
    expect(isComplaintSlaBreached('2020-01-01T00:00:00Z', 'open')).toBe(true)
    expect(isComplaintSlaBreached('2099-01-01T00:00:00Z', 'open')).toBe(false)
    expect(isComplaintSlaBreached('2020-01-01T00:00:00Z', 'resolved')).toBe(false)
  })
})

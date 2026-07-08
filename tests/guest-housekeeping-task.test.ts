import { describe, expect, it } from 'vitest'
import {
  guestRequestTaskMarker,
  parseGuestRequestIdFromNotes,
} from '@/lib/housekeeping/guest-task'

describe('guest housekeeping task markers', () => {
  it('builds and parses guest request markers in task notes', () => {
    const requestId = 'req-123'
    const marker = guestRequestTaskMarker(requestId)
    expect(marker).toBe('[guest-request:req-123]')
    expect(parseGuestRequestIdFromNotes(`Guest asked for towels ${marker}`)).toBe(requestId)
    expect(parseGuestRequestIdFromNotes('No marker here')).toBeNull()
  })
})

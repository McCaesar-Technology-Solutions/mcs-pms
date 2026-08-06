import { describe, expect, it } from 'vitest'
import {
  buildSyncPlan,
  shouldRefuseMassCancel,
  isTerminalIcalStatus,
} from '@/lib/ical/sync-plan'
import type { AirbnbMappedEvent } from '@/lib/ical/airbnb'

function event(
  partial: Partial<AirbnbMappedEvent> & Pick<AirbnbMappedEvent, 'uid' | 'kind'>,
): AirbnbMappedEvent {
  return {
    checkIn: '2026-08-10',
    checkOut: '2026-08-12',
    guestName: 'Guest',
    summary: 'Reserved',
    description: '',
    reservationUrl: null,
    ...partial,
  }
}

describe('shouldRefuseMassCancel', () => {
  it('refuses empty feed when open bookings exist', () => {
    const result = shouldRefuseMassCancel({
      previousEventsSynced: 5,
      incomingActiveEvents: 0,
      proposedCancels: 5,
      openSyncableCount: 5,
    })
    expect(result.refuse).toBe(true)
  })

  it('refuses empty feed even with force', () => {
    const result = shouldRefuseMassCancel({
      previousEventsSynced: 5,
      incomingActiveEvents: 0,
      proposedCancels: 5,
      openSyncableCount: 5,
      force: true,
    })
    expect(result.refuse).toBe(true)
  })

  it('refuses sharp shrink that would cancel most open bookings', () => {
    const result = shouldRefuseMassCancel({
      previousEventsSynced: 10,
      incomingActiveEvents: 2,
      proposedCancels: 8,
      openSyncableCount: 10,
    })
    expect(result.refuse).toBe(true)
  })

  it('allows normal single cancellation', () => {
    const result = shouldRefuseMassCancel({
      previousEventsSynced: 10,
      incomingActiveEvents: 9,
      proposedCancels: 1,
      openSyncableCount: 10,
    })
    expect(result.refuse).toBe(false)
  })

  it('allows sharp shrink when force is set (non-empty feed)', () => {
    const result = shouldRefuseMassCancel({
      previousEventsSynced: 10,
      incomingActiveEvents: 2,
      proposedCancels: 8,
      openSyncableCount: 10,
      force: true,
    })
    expect(result.refuse).toBe(false)
  })
})

describe('buildSyncPlan recovery semantics', () => {
  it('cancels missing syncable UIDs and skips in-house', () => {
    const plan = buildSyncPlan(
      [event({ uid: 'keep@airbnb.com', kind: 'reservation' })],
      [
        {
          id: 'a',
          ical_uid: 'keep@airbnb.com',
          guest_name: 'Keep',
          check_in: '2026-08-10',
          check_out: '2026-08-12',
          status: 'confirmed',
        },
        {
          id: 'b',
          ical_uid: 'gone@airbnb.com',
          guest_name: 'Gone',
          check_in: '2026-08-01',
          check_out: '2026-08-03',
          status: 'confirmed',
        },
        {
          id: 'c',
          ical_uid: 'house@airbnb.com',
          guest_name: 'In house',
          check_in: '2026-08-01',
          check_out: '2026-08-20',
          status: 'checked_in',
        },
      ],
    )

    expect(plan.actions.some((a) => a.type === 'cancel' && a.icalUid === 'gone@airbnb.com')).toBe(
      true,
    )
    expect(
      plan.actions.some((a) => a.type === 'skip' && a.icalUid === 'house@airbnb.com'),
    ).toBe(true)
  })

  it('creates when UID is new after terminal release', () => {
    const plan = buildSyncPlan(
      [event({ uid: 'back@airbnb.com', kind: 'reservation', guestName: 'Returned' })],
      [], // terminal UIDs already released before plan
    )
    expect(plan.actions).toEqual([
      expect.objectContaining({ type: 'create', event: expect.objectContaining({ uid: 'back@airbnb.com' }) }),
    ])
  })
})

describe('isTerminalIcalStatus', () => {
  it('marks cancelled and checked_out as terminal', () => {
    expect(isTerminalIcalStatus('cancelled')).toBe(true)
    expect(isTerminalIcalStatus('checked_out')).toBe(true)
    expect(isTerminalIcalStatus('confirmed')).toBe(false)
  })
})

import type { AirbnbMappedEvent } from '@/lib/ical/airbnb'

export type SyncableStatus =
  | 'inquiry'
  | 'provisional'
  | 'confirmed'
  | 'pre_arrival'

export const SYNCABLE_STATUSES: readonly SyncableStatus[] = [
  'inquiry',
  'provisional',
  'confirmed',
  'pre_arrival',
] as const

export interface ExistingIcalReservation {
  id: string
  ical_uid: string
  guest_name: string
  check_in: string
  check_out: string
  status: string | null
}

export type SyncPlanAction =
  | { type: 'create'; event: AirbnbMappedEvent }
  | {
      type: 'update'
      reservationId: string
      event: AirbnbMappedEvent
      changes: { guestName?: string; checkIn?: string; checkOut?: string }
    }
  | { type: 'cancel'; reservationId: string; icalUid: string; guestName: string }
  | { type: 'skip'; reason: string; icalUid: string }

export interface SyncPlan {
  actions: SyncPlanAction[]
  activeUids: Set<string>
}

export function isSyncableStatus(status: string | null | undefined): status is SyncableStatus {
  return (SYNCABLE_STATUSES as readonly string[]).includes(status ?? '')
}

/** Pure diff between feed events and existing iCal-linked reservations. */
export function buildSyncPlan(
  events: AirbnbMappedEvent[],
  existing: ExistingIcalReservation[],
): SyncPlan {
  const byUid = new Map(existing.map((r) => [r.ical_uid, r]))
  const actions: SyncPlanAction[] = []
  const activeUids = new Set<string>()

  for (const event of events) {
    if (event.kind === 'cancelled') {
      const row = byUid.get(event.uid)
      if (row && isSyncableStatus(row.status)) {
        actions.push({
          type: 'cancel',
          reservationId: row.id,
          icalUid: event.uid,
          guestName: row.guest_name,
        })
      } else if (row) {
        actions.push({
          type: 'skip',
          reason: `Cannot cancel reservation in status ${row.status}`,
          icalUid: event.uid,
        })
      }
      continue
    }

    activeUids.add(event.uid)
    const row = byUid.get(event.uid)
    if (!row) {
      actions.push({ type: 'create', event })
      continue
    }

    if (!isSyncableStatus(row.status)) {
      actions.push({
        type: 'skip',
        reason: `Reservation ${row.id} is ${row.status} — dates not overwritten from iCal`,
        icalUid: event.uid,
      })
      continue
    }

    const changes: { guestName?: string; checkIn?: string; checkOut?: string } = {}
    if (row.check_in !== event.checkIn) changes.checkIn = event.checkIn
    if (row.check_out !== event.checkOut) changes.checkOut = event.checkOut
    // Don't overwrite a staff-edited guest name with generic placeholders.
    if (
      row.guest_name !== event.guestName &&
      !event.guestName.startsWith('Airbnb guest') &&
      event.guestName !== 'Blocked (Airbnb)'
    ) {
      changes.guestName = event.guestName
    } else if (
      (row.guest_name.startsWith('Airbnb guest') || row.guest_name === 'Blocked (Airbnb)') &&
      row.guest_name !== event.guestName
    ) {
      changes.guestName = event.guestName
    }

    if (Object.keys(changes).length === 0) {
      actions.push({ type: 'skip', reason: 'unchanged', icalUid: event.uid })
      continue
    }

    actions.push({
      type: 'update',
      reservationId: row.id,
      event,
      changes,
    })
  }

  for (const row of existing) {
    if (activeUids.has(row.ical_uid)) continue
    if (!isSyncableStatus(row.status)) {
      actions.push({
        type: 'skip',
        reason: `Missing from feed but status ${row.status} — left unchanged`,
        icalUid: row.ical_uid,
      })
      continue
    }
    actions.push({
      type: 'cancel',
      reservationId: row.id,
      icalUid: row.ical_uid,
      guestName: row.guest_name,
    })
  }

  return { actions, activeUids }
}

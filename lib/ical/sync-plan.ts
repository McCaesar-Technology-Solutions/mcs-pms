import type { AirbnbMappedEvent } from '@/lib/ical/airbnb'

export type SyncableStatus =
  | 'inquiry'
  | 'provisional'
  | 'confirmed'
  | 'pre_arrival'

/** Statuses that still hold ical_uid for sync, but must never be cancelled/overwritten. */
export const PROTECTED_STATUSES = [
  'checked_in',
  'checkout_in_progress',
  'overstay',
  'dispute_hold',
] as const

/** Terminal statuses — UID should be released so the same Airbnb booking can re-import. */
export const TERMINAL_ICAL_STATUSES = [
  'cancelled',
  'released',
  'checked_out',
  'post_stay',
  'archived',
  'no_show',
  'walkout',
] as const

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

export function isProtectedStatus(status: string | null | undefined): boolean {
  return (PROTECTED_STATUSES as readonly string[]).includes(status ?? '')
}

export function isTerminalIcalStatus(status: string | null | undefined): boolean {
  return (TERMINAL_ICAL_STATUSES as readonly string[]).includes(status ?? '')
}

/**
 * Guard against truncated/empty Airbnb feeds wiping inventory.
 * When refused, callers should still apply creates/updates but drop cancels.
 */
export function shouldRefuseMassCancel(input: {
  previousEventsSynced: number
  incomingActiveEvents: number
  proposedCancels: number
  openSyncableCount: number
  force?: boolean
}): { refuse: boolean; reason?: string } {
  if (input.proposedCancels === 0) return { refuse: false }

  // Empty feed with open bookings is never safe — even manual Sync now.
  if (input.incomingActiveEvents === 0 && input.openSyncableCount > 0) {
    return {
      refuse: true,
      reason:
        'Feed returned 0 events while open Airbnb bookings exist — refusing mass cancel (possible feed glitch).',
    }
  }

  if (input.force) return { refuse: false }

  if (
    input.previousEventsSynced >= 3 &&
    input.incomingActiveEvents < input.previousEventsSynced * 0.4 &&
    input.proposedCancels >= Math.max(2, Math.ceil(input.openSyncableCount * 0.5))
  ) {
    return {
      refuse: true,
      reason:
        'Feed shrank sharply versus last sync — refusing mass cancel (possible truncated calendar).',
    }
  }

  return { refuse: false }
}

/** Pure diff between feed events and existing open iCal-linked reservations. */
export function buildSyncPlan(
  events: AirbnbMappedEvent[],
  existing: ExistingIcalReservation[],
): SyncPlan {
  // Prefer syncable/protected rows if duplicate UIDs ever appear.
  const byUid = new Map<string, ExistingIcalReservation>()
  for (const row of existing) {
    const prev = byUid.get(row.ical_uid)
    if (!prev) {
      byUid.set(row.ical_uid, row)
      continue
    }
    const prevRank =
      (isSyncableStatus(prev.status) ? 2 : 0) + (isProtectedStatus(prev.status) ? 3 : 0)
    const nextRank =
      (isSyncableStatus(row.status) ? 2 : 0) + (isProtectedStatus(row.status) ? 3 : 0)
    if (nextRank >= prevRank) byUid.set(row.ical_uid, row)
  }

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

    if (isProtectedStatus(row.status) || !isSyncableStatus(row.status)) {
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
    if (isProtectedStatus(row.status)) {
      actions.push({
        type: 'skip',
        reason: `Missing from feed but status ${row.status} — left unchanged`,
        icalUid: row.ical_uid,
      })
      continue
    }
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

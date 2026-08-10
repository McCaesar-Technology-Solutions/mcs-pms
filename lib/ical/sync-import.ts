import { createAdminClient } from '@/lib/supabase/admin'
import { roomHasClash } from '@/lib/data/occupancy'
import { getRoomRates } from '@/lib/pricing/room-rates'
import { calculateStayTotal } from '@/lib/pricing/stay-totals'
import { parseIcs } from '@/lib/ical/parse'
import { mapAirbnbEvents } from '@/lib/ical/airbnb'
import {
  fetchIcalFeed,
  isAirbnbCalendarHost,
  validateImportUrl,
} from '@/lib/ical/safe-fetch'
import {
  buildSyncPlan,
  isSyncableStatus,
  isTerminalIcalStatus,
  shouldRefuseMassCancel,
  type ExistingIcalReservation,
} from '@/lib/ical/sync-plan'
import { transitionReservation } from '@/lib/reservations/state-machine'
import { writeAuditLog } from '@/lib/audit/log'
import { runNotifyTask } from '@/lib/notifications/notify-task'

type Admin = ReturnType<typeof createAdminClient>

export interface ChannelIcalFeedRow {
  id: string
  hotel_id: string
  room_id: string | null
  name: string
  provider: 'airbnb' | 'booking_com' | 'other'
  direction: 'import' | 'export'
  import_url: string | null
  export_token: string
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: 'ok' | 'error' | 'pending' | null
  last_sync_message: string | null
  events_synced: number
  last_http_etag?: string | null
  last_content_hash?: string | null
  sync_lock_until?: string | null
}

export interface SyncFeedResult {
  feedId: string
  ok: boolean
  skipped?: boolean
  created: number
  updated: number
  cancelled: number
  conflicts: number
  skippedUnchanged: number
  message: string
  notModified?: boolean
}

const LOCK_TTL_MS = 2 * 60 * 1000

async function acquireSyncLock(admin: Admin, feedId: string): Promise<boolean> {
  const now = new Date()
  const lockUntil = new Date(now.getTime() + LOCK_TTL_MS).toISOString()
  const { data } = await admin
    .from('channel_ical_feeds')
    .update({
      sync_lock_until: lockUntil,
      last_sync_status: 'pending',
      updated_at: now.toISOString(),
    })
    .eq('id', feedId)
    .eq('is_active', true)
    .or(`sync_lock_until.is.null,sync_lock_until.lt."${now.toISOString()}"`)
    .select('id')
    .maybeSingle()

  return Boolean(data?.id)
}

async function releaseSyncLock(
  admin: Admin,
  feedId: string,
  patch: {
    last_sync_status: 'ok' | 'error'
    last_sync_message: string
    events_synced?: number
    last_http_etag?: string | null
    last_content_hash?: string | null
  },
): Promise<void> {
  await admin
    .from('channel_ical_feeds')
    .update({
      ...patch,
      last_sync_at: new Date().toISOString(),
      sync_lock_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedId)
}

/**
 * Free ical_uid on terminal reservations so the same Airbnb UID can re-import
 * (unique index on feed+uid would otherwise block forever).
 */
async function releaseTerminalIcalUids(admin: Admin, feedId: string): Promise<number> {
  const { data } = await admin
    .from('reservations')
    .select('id, status, ical_uid')
    .eq('ical_feed_id', feedId)
    .not('ical_uid', 'is', null)

  const terminalIds = (data ?? [])
    .filter((r) => r.ical_uid && isTerminalIcalStatus(r.status))
    .map((r) => r.id)

  if (terminalIds.length === 0) return 0

  const { error } = await admin
    .from('reservations')
    .update({ ical_uid: null })
    .in('id', terminalIds)
    .eq('ical_feed_id', feedId)

  if (error) {
    console.error('[ical-sync] failed to release terminal UIDs:', error.message)
    return 0
  }
  return terminalIds.length
}

async function loadExistingForFeed(
  admin: Admin,
  feedId: string,
): Promise<ExistingIcalReservation[]> {
  const { data } = await admin
    .from('reservations')
    .select('id, ical_uid, guest_name, check_in, check_out, status')
    .eq('ical_feed_id', feedId)
    .not('ical_uid', 'is', null)

  const rows: ExistingIcalReservation[] = []
  for (const r of data ?? []) {
    if (!r.ical_uid) continue
    // Terminal rows should already have UIDs cleared; skip if any remain.
    if (isTerminalIcalStatus(r.status)) continue
    rows.push({
      id: r.id,
      ical_uid: r.ical_uid,
      guest_name: r.guest_name,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status,
    })
  }
  return rows
}

async function createFromEvent(
  admin: Admin,
  feed: ChannelIcalFeedRow,
  event: {
    uid: string
    guestName: string
    checkIn: string
    checkOut: string
    reservationUrl: string | null
  },
): Promise<{ ok: true; id: string } | { ok: false; conflict: boolean; error: string }> {
  if (!feed.room_id) {
    return { ok: false, conflict: false, error: 'Feed has no room.' }
  }

  const clash = await roomHasClash(
    admin,
    feed.hotel_id,
    feed.room_id,
    event.checkIn,
    event.checkOut,
  )
  if (clash) {
    return {
      ok: false,
      conflict: true,
      error: `Room conflict for ${event.checkIn} → ${event.checkOut}`,
    }
  }

  const rates = await getRoomRates(admin, feed.room_id)
  const total = calculateStayTotal(
    'nightly',
    event.checkIn,
    event.checkOut,
    rates.nightlyRate,
    rates.monthlyRate,
    rates.weeklyRate,
  )

  const channel =
    feed.provider === 'airbnb'
      ? 'airbnb'
      : feed.provider === 'booking_com'
        ? 'booking_com'
        : 'other'

  const { data: row, error } = await admin
    .from('reservations')
    .insert({
      hotel_id: feed.hotel_id,
      room_id: feed.room_id,
      guest_name: event.guestName,
      check_in: event.checkIn,
      check_out: event.checkOut,
      status: 'inquiry',
      channel,
      rate_type: 'nightly',
      nightly_rate: rates.nightlyRate,
      weekly_rate: rates.weeklyRate,
      monthly_rate: rates.monthlyRate,
      total_amount: total,
      payment_status: 'unpaid',
      amount_paid: 0,
      deposit_amount: 0,
      ical_uid: event.uid,
      ical_feed_id: feed.id,
      created_by: null,
    })
    .select('id')
    .single()

  if (error || !row) {
    // Unique violation on (ical_feed_id, ical_uid) — treat as race, not fatal.
    if (error?.code === '23505') {
      return { ok: false, conflict: false, error: 'Already synced (race).' }
    }
    // Double-booking exclusion constraint
    if (error?.code === '23P01' || /overlap|exclusion|clash/i.test(error?.message ?? '')) {
      return { ok: false, conflict: true, error: error?.message ?? 'Room conflict.' }
    }
    return { ok: false, conflict: false, error: error?.message ?? 'Insert failed.' }
  }

  const confirmed = await transitionReservation({
    reservationId: row.id,
    hotelId: feed.hotel_id,
    toStatus: 'confirmed',
    actorRole: 'system',
    bypassRoleCheck: true,
    eventType: 'direct_confirmed',
    payload: {
      source: 'ical_import',
      provider: feed.provider,
      icalUid: event.uid,
      reservationUrl: event.reservationUrl,
      channel,
    },
  })

  if (!confirmed.success) {
    await admin.from('reservations').delete().eq('id', row.id)
    if (confirmed.code === 'ROOM_CONFLICT') {
      return { ok: false, conflict: true, error: confirmed.error ?? 'Room conflict.' }
    }
    return { ok: false, conflict: false, error: confirmed.error ?? 'Could not confirm.' }
  }

  void writeAuditLog({
    hotelId: feed.hotel_id,
    actorId: null,
    actorName: 'Airbnb sync',
    entityType: 'reservation',
    entityId: row.id,
    action: 'ical_imported',
    summary: `Airbnb iCal import: ${event.guestName} (${event.checkIn} → ${event.checkOut})`,
    details: { icalUid: event.uid, feedId: feed.id, reservationUrl: event.reservationUrl },
  })

  return { ok: true, id: row.id }
}

async function updateFromEvent(
  admin: Admin,
  feed: ChannelIcalFeedRow,
  reservationId: string,
  event: { uid: string; guestName: string; checkIn: string; checkOut: string },
  changes: { guestName?: string; checkIn?: string; checkOut?: string },
): Promise<{ ok: true } | { ok: false; conflict: boolean; error: string }> {
  if (!feed.room_id) {
    return { ok: false, conflict: false, error: 'Feed has no room.' }
  }

  const nextIn = changes.checkIn
  const nextOut = changes.checkOut
  if (nextIn || nextOut) {
    const { data: current } = await admin
      .from('reservations')
      .select('check_in, check_out')
      .eq('id', reservationId)
      .maybeSingle()
    if (!current) return { ok: false, conflict: false, error: 'Reservation not found.' }

    const checkIn = nextIn ?? current.check_in
    const checkOut = nextOut ?? current.check_out
    const clash = await roomHasClash(
      admin,
      feed.hotel_id,
      feed.room_id,
      checkIn,
      checkOut,
      { excludeReservationId: reservationId },
    )
    if (clash) {
      return { ok: false, conflict: true, error: `Update conflict for ${checkIn} → ${checkOut}` }
    }

    const rates = await getRoomRates(admin, feed.room_id)
    const total = calculateStayTotal(
      'nightly',
      checkIn,
      checkOut,
      rates.nightlyRate,
      rates.monthlyRate,
      rates.weeklyRate,
    )

    const { error } = await admin
      .from('reservations')
      .update({
        ...(changes.guestName ? { guest_name: changes.guestName } : {}),
        check_in: checkIn,
        check_out: checkOut,
        nightly_rate: rates.nightlyRate,
        weekly_rate: rates.weeklyRate,
        monthly_rate: rates.monthlyRate,
        total_amount: total,
      })
      .eq('id', reservationId)
      .eq('hotel_id', feed.hotel_id)

    if (error) {
      if (error.code === '23P01' || /overlap|exclusion|clash/i.test(error.message)) {
        return { ok: false, conflict: true, error: error.message }
      }
      return { ok: false, conflict: false, error: error.message }
    }
  } else if (changes.guestName) {
    const { error } = await admin
      .from('reservations')
      .update({ guest_name: changes.guestName })
      .eq('id', reservationId)
      .eq('hotel_id', feed.hotel_id)
    if (error) return { ok: false, conflict: false, error: error.message }
  }

  void writeAuditLog({
    hotelId: feed.hotel_id,
    actorId: null,
    actorName: 'Airbnb sync',
    entityType: 'reservation',
    entityId: reservationId,
    action: 'ical_updated',
    summary: `Airbnb iCal update for ${event.guestName}`,
    details: { icalUid: event.uid, changes },
  })

  return { ok: true }
}

async function cancelFromFeed(
  feed: ChannelIcalFeedRow,
  reservationId: string,
  guestName: string,
  icalUid: string,
): Promise<boolean> {
  const result = await transitionReservation({
    reservationId,
    hotelId: feed.hotel_id,
    toStatus: 'cancelled',
    actorRole: 'system',
    bypassRoleCheck: true,
    eventType: 'ota_cancellation_received',
    payload: {
      source: 'ical_import',
      provider: feed.provider,
      icalUid,
    },
  })

  if (result.success) {
    // Release UID so a later reappearance of the same Airbnb booking can import again.
    const admin = createAdminClient()
    await admin
      .from('reservations')
      .update({ ical_uid: null })
      .eq('id', reservationId)
      .eq('hotel_id', feed.hotel_id)

    void writeAuditLog({
      hotelId: feed.hotel_id,
      actorId: null,
      actorName: 'Airbnb sync',
      entityType: 'reservation',
      entityId: reservationId,
      action: 'ical_cancelled',
      summary: `Airbnb iCal cancellation: ${guestName}`,
      details: { icalUid, feedId: feed.id },
    })
  }

  return result.success
}

export async function syncImportFeed(
  feed: ChannelIcalFeedRow,
  opts: { force?: boolean } = {},
): Promise<SyncFeedResult> {
  const admin = createAdminClient()
  const empty = {
    feedId: feed.id,
    created: 0,
    updated: 0,
    cancelled: 0,
    conflicts: 0,
    skippedUnchanged: 0,
  }

  if (feed.direction !== 'import' || !feed.is_active) {
    return { ...empty, ok: false, message: 'Feed is not an active import.' }
  }
  if (!feed.import_url || !feed.room_id) {
    return { ...empty, ok: false, message: 'Import feed requires a room and calendar URL.' }
  }
  if (feed.provider !== 'airbnb' && feed.provider !== 'booking_com' && feed.provider !== 'other') {
    return { ...empty, ok: false, message: 'Unsupported provider.' }
  }

  const locked = await acquireSyncLock(admin, feed.id)
  if (!locked) {
    return {
      ...empty,
      ok: true,
      skipped: true,
      message: 'Sync already in progress for this feed.',
    }
  }

  try {
    const urlCheck = validateImportUrl(feed.import_url)
    if (!urlCheck.ok) {
      await releaseSyncLock(admin, feed.id, {
        last_sync_status: 'error',
        last_sync_message: urlCheck.error.slice(0, 500),
      })
      return { ...empty, ok: false, message: urlCheck.error }
    }
    if (feed.provider === 'airbnb' && !isAirbnbCalendarHost(urlCheck.url.hostname)) {
      const msg = 'Import URL host is not an allowed Airbnb calendar host.'
      await releaseSyncLock(admin, feed.id, {
        last_sync_status: 'error',
        last_sync_message: msg,
      })
      return { ...empty, ok: false, message: msg }
    }

    const fetched = await fetchIcalFeed(feed.import_url, {
      etag: opts.force ? null : feed.last_http_etag,
    })

    if (!fetched.ok) {
      await releaseSyncLock(admin, feed.id, {
        last_sync_status: 'error',
        last_sync_message: fetched.error.slice(0, 500),
      })
      return { ...empty, ok: false, message: fetched.error }
    }

    if (fetched.notModified) {
      await releaseSyncLock(admin, feed.id, {
        last_sync_status: 'ok',
        last_sync_message: 'Not modified (ETag).',
        events_synced: feed.events_synced,
        last_http_etag: fetched.etag ?? feed.last_http_etag,
      })
      return {
        ...empty,
        ok: true,
        notModified: true,
        message: 'Not modified.',
        skippedUnchanged: feed.events_synced,
      }
    }

    if (
      !opts.force &&
      feed.last_content_hash &&
      fetched.contentHash === feed.last_content_hash
    ) {
      await releaseSyncLock(admin, feed.id, {
        last_sync_status: 'ok',
        last_sync_message: 'Unchanged content hash.',
        events_synced: feed.events_synced,
        last_http_etag: fetched.etag ?? feed.last_http_etag,
        last_content_hash: fetched.contentHash,
      })
      return {
        ...empty,
        ok: true,
        notModified: true,
        message: 'Unchanged.',
        skippedUnchanged: feed.events_synced,
      }
    }

    const body = fetched.body ?? ''
    if (!/BEGIN:VCALENDAR/i.test(body)) {
      await releaseSyncLock(admin, feed.id, {
        last_sync_status: 'error',
        last_sync_message: 'Response is not a valid iCalendar feed.',
      })
      return { ...empty, ok: false, message: 'Response is not a valid iCalendar feed.' }
    }

    const parsed = parseIcs(body)
    const mapped = mapAirbnbEvents(parsed.events)
    const activeEvents = mapped.filter((e) => e.kind !== 'cancelled')

    await releaseTerminalIcalUids(admin, feed.id)
    const existing = await loadExistingForFeed(admin, feed.id)
    let plan = buildSyncPlan(mapped, existing)

    const openSyncableCount = existing.filter((r) => isSyncableStatus(r.status)).length
    const proposedCancels = plan.actions.filter((a) => a.type === 'cancel').length
    const massCancelGuard = shouldRefuseMassCancel({
      previousEventsSynced: feed.events_synced,
      incomingActiveEvents: activeEvents.length,
      proposedCancels,
      openSyncableCount,
      force: opts.force,
    })

    if (massCancelGuard.refuse) {
      plan = {
        ...plan,
        actions: plan.actions.filter((a) => a.type !== 'cancel'),
      }
    }

    let created = 0
    let updated = 0
    let cancelled = 0
    let conflicts = 0
    let skippedUnchanged = 0
    const conflictNotes: string[] = []
    const createdNotify: {
      guestName: string
      checkIn: string
      checkOut: string
    }[] = []

    for (const action of plan.actions) {
      if (action.type === 'skip') {
        if (action.reason === 'unchanged') skippedUnchanged++
        continue
      }

      if (action.type === 'create') {
        const result = await createFromEvent(admin, feed, {
          uid: action.event.uid,
          guestName: action.event.guestName,
          checkIn: action.event.checkIn,
          checkOut: action.event.checkOut,
          reservationUrl: action.event.reservationUrl,
        })
        if (result.ok) {
          created++
          // Blocks still reserve the room; only notify for real guest stays.
          if (action.event.kind === 'reservation') {
            createdNotify.push({
              guestName: action.event.guestName,
              checkIn: action.event.checkIn,
              checkOut: action.event.checkOut,
            })
          }
        } else if (result.conflict) {
          conflicts++
          if (conflictNotes.length < 5) conflictNotes.push(result.error)
        }
        continue
      }

      if (action.type === 'update') {
        const result = await updateFromEvent(
          admin,
          feed,
          action.reservationId,
          {
            uid: action.event.uid,
            guestName: action.event.guestName,
            checkIn: action.event.checkIn,
            checkOut: action.event.checkOut,
          },
          action.changes,
        )
        if (result.ok) updated++
        else if (result.conflict) {
          conflicts++
          if (conflictNotes.length < 5) conflictNotes.push(result.error)
        }
        continue
      }

      if (action.type === 'cancel') {
        const ok = await cancelFromFeed(
          feed,
          action.reservationId,
          action.guestName,
          action.icalUid,
        )
        if (ok) cancelled++
      }
    }

    const eventsSynced = activeEvents.length
    const messageParts = [
      `Synced ${eventsSynced} event(s): +${created} ~${updated} -${cancelled}`,
    ]
    if (conflicts) messageParts.push(`${conflicts} conflict(s)`)
    if (massCancelGuard.refuse && massCancelGuard.reason) {
      messageParts.push(massCancelGuard.reason)
    }
    if (conflictNotes.length) messageParts.push(conflictNotes.join('; '))

    const message = messageParts.join(' · ').slice(0, 500)
    const statusError =
      (conflicts > 0 && created + updated + cancelled === 0) ||
      Boolean(massCancelGuard.refuse)
    const ok =
      !massCancelGuard.refuse &&
      (conflicts === 0 || created + updated + cancelled > 0 || eventsSynced === 0)

    await releaseSyncLock(admin, feed.id, {
      last_sync_status: statusError ? 'error' : 'ok',
      last_sync_message: message,
      events_synced: eventsSynced,
      last_http_etag: fetched.etag,
      last_content_hash: fetched.contentHash,
    })

    if (createdNotify.length > 0) {
      const { data: room } = await admin
        .from('rooms')
        .select('number')
        .eq('id', feed.room_id)
        .maybeSingle()

      void import('@/lib/notifications/stays').then(({ notifyManagersNewReservation }) => {
        for (const item of createdNotify.slice(0, 10)) {
          runNotifyTask(
            notifyManagersNewReservation({
              hotelId: feed.hotel_id,
              guestName: item.guestName,
              roomNumber: room?.number ?? null,
              checkIn: item.checkIn,
              checkOut: item.checkOut,
              channel: feed.provider === 'airbnb' ? 'airbnb' : feed.provider,
            }),
            {
              templateKey: 'reservation_new_manager',
              hotelId: feed.hotel_id,
            },
          )
        }
      })
    }

    return {
      feedId: feed.id,
      ok,
      created,
      updated,
      cancelled,
      conflicts,
      skippedUnchanged,
      message,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.'
    await releaseSyncLock(admin, feed.id, {
      last_sync_status: 'error',
      last_sync_message: message.slice(0, 500),
    })
    return { ...empty, ok: false, message }
  }
}

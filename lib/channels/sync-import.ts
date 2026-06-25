import { createAdminClient } from '@/lib/supabase/admin'
import { roomHasClash } from '@/lib/data/occupancy'
import { isAllowedImportUrl } from '@/lib/channels/import-url'
import { parseICalEvents } from '@/lib/ical/parse'
import type { ReservationChannel } from '@/types'

export interface ImportSyncResult {
  ok: boolean
  imported?: number
  updated?: number
  cancelled?: number
  skipped?: number
  error?: string
}

function providerToChannel(provider: string): ReservationChannel {
  if (provider === 'airbnb') return 'airbnb'
  if (provider === 'booking_com') return 'booking_com'
  return 'other'
}

async function updateFeedStatus(
  feedId: string,
  status: 'ok' | 'error' | 'pending',
  message: string,
  eventsSynced?: number,
) {
  const admin = createAdminClient()
  await admin
    .from('channel_ical_feeds')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_message: message.slice(0, 500),
      ...(eventsSynced != null ? { events_synced: eventsSynced } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', feedId)
}

export async function syncImportFeed(feedId: string): Promise<ImportSyncResult> {
  const admin = createAdminClient()
  const { data: feed, error: feedError } = await admin
    .from('channel_ical_feeds')
    .select('*')
    .eq('id', feedId)
    .maybeSingle()

  if (feedError || !feed) {
    return { ok: false, error: feedError?.message ?? 'Feed not found.' }
  }
  if (feed.direction !== 'import') {
    return { ok: false, error: 'Not an import feed.' }
  }
  if (!feed.is_active) {
    return { ok: false, error: 'Feed is inactive.' }
  }

  const importUrl = feed.import_url?.trim()
  if (!importUrl || !isAllowedImportUrl(importUrl)) {
    const message = 'Invalid or disallowed import URL.'
    await updateFeedStatus(feedId, 'error', message)
    return { ok: false, error: message }
  }

  await updateFeedStatus(feedId, 'pending', 'Sync in progress…')

  let icalText: string
  try {
    const response = await fetch(importUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'MOJO-PMS/1.0 (+ical-sync)' },
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`Calendar fetch failed (HTTP ${response.status}).`)
    }
    icalText = await response.text()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar fetch failed.'
    await updateFeedStatus(feedId, 'error', message)
    return { ok: false, error: message }
  }

  const events = parseICalEvents(icalText)
  const channel = providerToChannel(feed.provider)
  const seenUids = new Set<string>()
  let imported = 0
  let updated = 0
  let cancelled = 0
  let skipped = 0

  for (const event of events) {
    if (!event.uid || event.dtstart >= event.dtend) {
      skipped++
      continue
    }
    seenUids.add(event.uid)

    if (event.status === 'CANCELLED') {
      const { data: existing } = await admin
        .from('reservations')
        .select('id, status')
        .eq('ical_feed_id', feedId)
        .eq('ical_uid', event.uid)
        .maybeSingle()

      if (existing?.status === 'confirmed') {
        await admin.from('reservations').update({ status: 'cancelled' }).eq('id', existing.id)
        cancelled++
      }
      continue
    }

    const { data: existing } = await admin
      .from('reservations')
      .select('id, status, check_in, check_out, guest_name')
      .eq('ical_feed_id', feedId)
      .eq('ical_uid', event.uid)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'checked_out' || existing.status === 'cancelled') continue

      const patch: {
        check_in?: string
        check_out?: string
        guest_name?: string
      } = {}
      if (existing.check_in !== event.dtstart) patch.check_in = event.dtstart
      if (existing.check_out !== event.dtend) patch.check_out = event.dtend
      const guestName = event.summary.slice(0, 200) || 'OTA Guest'
      if (existing.guest_name !== guestName) patch.guest_name = guestName

      if (Object.keys(patch).length > 0) {
        await admin.from('reservations').update(patch).eq('id', existing.id)
        updated++
      }
      continue
    }

    if (feed.room_id) {
      const clash = await roomHasClash(
        admin,
        feed.hotel_id,
        feed.room_id,
        event.dtstart,
        event.dtend,
      )
      if (clash) {
        skipped++
        continue
      }
    }

    const { error: insertError } = await admin.from('reservations').insert({
      hotel_id: feed.hotel_id,
      room_id: feed.room_id,
      guest_name: event.summary.slice(0, 200) || 'OTA Guest',
      check_in: event.dtstart,
      check_out: event.dtend,
      status: 'confirmed',
      channel,
      rate_type: 'nightly',
      ical_uid: event.uid,
      ical_feed_id: feedId,
    })

    if (insertError) {
      skipped++
      continue
    }
    imported++
  }

  const { data: staleRows } = await admin
    .from('reservations')
    .select('id, ical_uid')
    .eq('ical_feed_id', feedId)
    .eq('status', 'confirmed')
    .not('ical_uid', 'is', null)

  for (const row of staleRows ?? []) {
    if (row.ical_uid && !seenUids.has(row.ical_uid)) {
      await admin.from('reservations').update({ status: 'cancelled' }).eq('id', row.id)
      cancelled++
    }
  }

  const total = imported + updated + cancelled
  const message = `Imported ${imported}, updated ${updated}, cancelled ${cancelled}${skipped ? `, skipped ${skipped}` : ''}.`
  await updateFeedStatus(feedId, 'ok', message, total)

  return { ok: true, imported, updated, cancelled, skipped }
}

export async function syncAllImportFeeds(): Promise<{ synced: number; failed: number }> {
  const admin = createAdminClient()
  const { data: feeds } = await admin
    .from('channel_ical_feeds')
    .select('id')
    .eq('direction', 'import')
    .eq('is_active', true)

  let synced = 0
  let failed = 0

  for (const feed of feeds ?? []) {
    const result = await syncImportFeed(feed.id)
    if (result.ok) synced++
    else failed++
  }

  return { synced, failed }
}

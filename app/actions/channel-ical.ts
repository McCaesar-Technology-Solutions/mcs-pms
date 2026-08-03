'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRateLimit } from '@/lib/rate-limit'
import { validateImportUrl, isAirbnbCalendarHost } from '@/lib/ical/safe-fetch'
import { syncImportFeed, type ChannelIcalFeedRow } from '@/lib/ical/sync-import'
import { writeAuditLog } from '@/lib/audit/log'

export type ChannelIcalActionResult =
  | { success: true; message?: string; exportUrl?: string }
  | { success: false; error: string }

const upsertImportSchema = z.object({
  hotelId: z.string().uuid(),
  roomId: z.string().uuid(),
  importUrl: z.string().url().max(2000),
  name: z.string().trim().min(2).max(120).optional(),
})

function revalidateChannelViews() {
  revalidatePath('/owner/settings')
  revalidatePath('/owner/reservations')
  revalidatePath('/manager/reservations')
  revalidatePath('/receptionist/reservations')
}

async function requireOwner(hotelId: string) {
  const result = await requireVerifiedStaff()
  if (!result.ok || !result.profile) {
    return { profile: null as null, error: 'Not authorized.' }
  }
  const profile = result.profile
  if (profile.role !== 'owner' || profile.hotel_id !== hotelId) {
    return { profile: null, error: 'Only the property owner can manage Airbnb sync.' }
  }
  return { profile, error: null }
}

async function ensureExportFeed(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  roomId: string,
  roomNumber: string,
): Promise<{ exportToken: string; exportFeedId: string }> {
  const { data: existing } = await admin
    .from('channel_ical_feeds')
    .select('id, export_token')
    .eq('hotel_id', hotelId)
    .eq('room_id', roomId)
    .eq('direction', 'export')
    .eq('provider', 'airbnb')
    .maybeSingle()

  if (existing) {
    if (!existing.export_token) {
      throw new Error('Export feed missing token.')
    }
    await admin
      .from('channel_ical_feeds')
      .update({ is_active: true, name: `Airbnb export · Room ${roomNumber}`, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    return { exportToken: existing.export_token, exportFeedId: existing.id }
  }

  const { data: created, error } = await admin
    .from('channel_ical_feeds')
    .insert({
      hotel_id: hotelId,
      room_id: roomId,
      name: `Airbnb export · Room ${roomNumber}`,
      provider: 'airbnb',
      direction: 'export',
      import_url: null,
      is_active: true,
    })
    .select('id, export_token')
    .single()

  if (error || !created) {
    throw new Error(error?.message ?? 'Could not create export calendar.')
  }
  return { exportToken: created.export_token, exportFeedId: created.id }
}

/** Connect an Airbnb calendar export URL to a room (creates import + export feeds). */
export async function upsertAirbnbImportFeed(input: unknown): Promise<ChannelIcalActionResult> {
  const parsed = upsertImportSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { hotelId, roomId, importUrl, name } = parsed.data
  const { profile, error: authError } = await requireOwner(hotelId)
  if (!profile) return { success: false, error: authError ?? 'Not authorized.' }

  const urlCheck = validateImportUrl(importUrl)
  if (!urlCheck.ok) return { success: false, error: urlCheck.error }

  if (!isAirbnbCalendarHost(urlCheck.url.hostname)) {
    return {
      success: false,
      error: 'URL must be an Airbnb calendar link (airbnb.com or muscache.com).',
    }
  }

  const admin = createAdminClient()
  const { data: room } = await admin
    .from('rooms')
    .select('id, number')
    .eq('id', roomId)
    .eq('hotel_id', hotelId)
    .maybeSingle()

  if (!room) return { success: false, error: 'Room not found for this property.' }

  const feedName = name?.trim() || `Airbnb · Room ${room.number}`

  try {
    const { exportToken } = await ensureExportFeed(admin, hotelId, roomId, room.number)

    const { data: existingImport } = await admin
      .from('channel_ical_feeds')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('room_id', roomId)
      .eq('direction', 'import')
      .eq('provider', 'airbnb')
      .maybeSingle()

    if (existingImport) {
      const { error } = await admin
        .from('channel_ical_feeds')
        .update({
          name: feedName,
          import_url: urlCheck.url.toString(),
          is_active: true,
          last_sync_status: 'pending',
          last_sync_message: 'Connected — waiting for first sync.',
          last_http_etag: null,
          last_content_hash: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingImport.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await admin.from('channel_ical_feeds').insert({
        hotel_id: hotelId,
        room_id: roomId,
        name: feedName,
        provider: 'airbnb',
        direction: 'import',
        import_url: urlCheck.url.toString(),
        is_active: true,
        last_sync_status: 'pending',
        last_sync_message: 'Connected — waiting for first sync.',
      })
      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'This room already has an active Airbnb import feed.' }
        }
        return { success: false, error: error.message }
      }
    }

    void writeAuditLog({
      hotelId,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'hotel',
      entityId: hotelId,
      action: 'airbnb_ical_connected',
      summary: `Connected Airbnb calendar for room ${room.number}`,
      details: { roomId, host: urlCheck.url.hostname },
    })

    const { getAppOrigin } = await import('@/lib/env')
    const exportUrl = `${getAppOrigin()}/api/ical/${exportToken}.ics`

    revalidateChannelViews()
    return {
      success: true,
      message: 'Airbnb calendar connected. Paste the export URL into Airbnb Import calendar.',
      exportUrl,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not connect calendar.',
    }
  }
}

export async function setAirbnbFeedActive(input: {
  feedId: string
  hotelId: string
  active: boolean
}): Promise<ChannelIcalActionResult> {
  const { profile, error: authError } = await requireOwner(input.hotelId)
  if (!profile) return { success: false, error: authError ?? 'Not authorized.' }

  const admin = createAdminClient()
  const { data: feed } = await admin
    .from('channel_ical_feeds')
    .select('id, room_id, direction, provider')
    .eq('id', input.feedId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!feed) return { success: false, error: 'Feed not found.' }

  const { error } = await admin
    .from('channel_ical_feeds')
    .update({ is_active: input.active, updated_at: new Date().toISOString() })
    .eq('id', input.feedId)
    .eq('hotel_id', input.hotelId)

  if (error) return { success: false, error: error.message }

  // Keep export feed aligned with import for the same room.
  if (feed.direction === 'import' && feed.room_id) {
    await admin
      .from('channel_ical_feeds')
      .update({ is_active: input.active, updated_at: new Date().toISOString() })
      .eq('hotel_id', input.hotelId)
      .eq('room_id', feed.room_id)
      .eq('direction', 'export')
      .eq('provider', 'airbnb')
  }

  revalidateChannelViews()
  return { success: true, message: input.active ? 'Feed enabled.' : 'Feed paused.' }
}

export async function deleteAirbnbFeed(input: {
  feedId: string
  hotelId: string
}): Promise<ChannelIcalActionResult> {
  const { profile, error: authError } = await requireOwner(input.hotelId)
  if (!profile) return { success: false, error: authError ?? 'Not authorized.' }

  const admin = createAdminClient()
  const { data: feed } = await admin
    .from('channel_ical_feeds')
    .select('id, room_id, direction')
    .eq('id', input.feedId)
    .eq('hotel_id', input.hotelId)
    .maybeSingle()

  if (!feed) return { success: false, error: 'Feed not found.' }

  // Soft-delete: deactivate. Keep historical ical_uid links on reservations.
  const { error } = await admin
    .from('channel_ical_feeds')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', input.feedId)

  if (error) return { success: false, error: error.message }

  if (feed.room_id) {
    await admin
      .from('channel_ical_feeds')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('hotel_id', input.hotelId)
      .eq('room_id', feed.room_id)
      .eq('provider', 'airbnb')
  }

  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'hotel',
    entityId: input.hotelId,
    action: 'airbnb_ical_disconnected',
    summary: 'Disconnected Airbnb calendar feed',
    details: { feedId: input.feedId, roomId: feed.room_id },
  })

  revalidateChannelViews()
  return { success: true, message: 'Airbnb sync disconnected for this room.' }
}

export async function syncAirbnbFeedNow(input: {
  feedId: string
  hotelId: string
}): Promise<ChannelIcalActionResult> {
  const { profile, error: authError } = await requireOwner(input.hotelId)
  if (!profile) return { success: false, error: authError ?? 'Not authorized.' }

  const limited = await assertRateLimit(
    `staff:ical-sync:${profile.id}:${input.feedId}`,
    { max: 6, windowMs: 15 * 60 * 1000, cooldownMs: 15_000 },
    'Sync is rate-limited. Wait a moment and try again.',
  )
  if (limited) return { success: false, error: limited }

  const admin = createAdminClient()
  const { data: feed } = await admin
    .from('channel_ical_feeds')
    .select(
      'id, hotel_id, room_id, name, provider, direction, import_url, export_token, is_active, last_sync_at, last_sync_status, last_sync_message, events_synced, last_http_etag, last_content_hash, sync_lock_until',
    )
    .eq('id', input.feedId)
    .eq('hotel_id', input.hotelId)
    .eq('direction', 'import')
    .maybeSingle()

  if (!feed) return { success: false, error: 'Import feed not found.' }

  const result = await syncImportFeed(feed as ChannelIcalFeedRow, { force: true })
  revalidateChannelViews()

  if (!result.ok && !result.skipped) {
    return { success: false, error: result.message }
  }

  return {
    success: true,
    message: result.message,
  }
}

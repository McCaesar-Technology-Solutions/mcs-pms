'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAllowedImportUrl } from '@/lib/channels/import-url'
import { syncImportFeed } from '@/lib/channels/sync-import'
import type { ChannelProvider } from '@/types'

export type ChannelActionResult = { success: true } | { success: false; error: string }

const createImportFeedSchema = z.object({
  name: z.string().min(2, 'Name is required.'),
  provider: z.enum(['airbnb', 'booking_com', 'other']),
  importUrl: z.string().url('Enter a valid HTTPS calendar URL.'),
  roomId: z.string().uuid().optional().or(z.literal('')),
})

async function requireOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner' || !profile.hotel_id) {
    return { supabase, profile: null }
  }

  return { supabase, profile }
}

function revalidateChannelViews() {
  revalidatePath('/owner/channels')
  revalidatePath('/owner/reservations')
  revalidatePath('/owner/dashboard')
}

export async function createImportFeed(input: unknown): Promise<ChannelActionResult> {
  const parsed = createImportFeedSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  if (!isAllowedImportUrl(parsed.data.importUrl)) {
    return { success: false, error: 'Calendar URL must be a public HTTPS link.' }
  }

  const { supabase, profile } = await requireOwner()
  if (!profile?.hotel_id) return { success: false, error: 'Unauthorized.' }

  const roomId = parsed.data.roomId?.trim() || null
  if (roomId) {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .eq('hotel_id', profile.hotel_id)
      .maybeSingle()
    if (!room) return { success: false, error: 'Room not found.' }
  }

  const { error } = await supabase.from('channel_ical_feeds').insert({
    hotel_id: profile.hotel_id,
    room_id: roomId,
    name: parsed.data.name.trim(),
    provider: parsed.data.provider as ChannelProvider,
    direction: 'import',
    import_url: parsed.data.importUrl.trim(),
    is_active: true,
  })

  if (error) return { success: false, error: error.message }

  revalidateChannelViews()
  return { success: true }
}

export async function deleteChannelFeed(feedId: string): Promise<ChannelActionResult> {
  const { supabase, profile } = await requireOwner()
  if (!profile?.hotel_id) return { success: false, error: 'Unauthorized.' }

  const { error } = await supabase
    .from('channel_ical_feeds')
    .delete()
    .eq('id', feedId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  revalidateChannelViews()
  return { success: true }
}

export async function setChannelFeedActive(
  feedId: string,
  isActive: boolean,
): Promise<ChannelActionResult> {
  const { supabase, profile } = await requireOwner()
  if (!profile?.hotel_id) return { success: false, error: 'Unauthorized.' }

  const { error } = await supabase
    .from('channel_ical_feeds')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', feedId)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  revalidateChannelViews()
  return { success: true }
}

export async function syncChannelFeedNow(feedId: string): Promise<ChannelActionResult> {
  const { profile } = await requireOwner()
  if (!profile?.hotel_id) return { success: false, error: 'Unauthorized.' }

  const admin = createAdminClient()
  const { data: feed } = await admin
    .from('channel_ical_feeds')
    .select('id, hotel_id, direction')
    .eq('id', feedId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!feed) return { success: false, error: 'Feed not found.' }
  if (feed.direction !== 'import') {
    return { success: false, error: 'Only import feeds can be synced.' }
  }

  const result = await syncImportFeed(feedId)
  revalidateChannelViews()

  if (!result.ok) return { success: false, error: result.error ?? 'Sync failed.' }
  return { success: true }
}

export async function regenerateExportToken(feedId: string): Promise<ChannelActionResult> {
  const { supabase, profile } = await requireOwner()
  if (!profile?.hotel_id) return { success: false, error: 'Unauthorized.' }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8)

  const { error } = await supabase
    .from('channel_ical_feeds')
    .update({ export_token: token, updated_at: new Date().toISOString() })
    .eq('id', feedId)
    .eq('hotel_id', profile.hotel_id)
    .eq('direction', 'export')

  if (error) return { success: false, error: error.message }

  revalidateChannelViews()
  return { success: true }
}

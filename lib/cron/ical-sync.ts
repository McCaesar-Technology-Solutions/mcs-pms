import { createAdminClient } from '@/lib/supabase/admin'
import { syncImportFeed, type ChannelIcalFeedRow, type SyncFeedResult } from '@/lib/ical/sync-import'

const FEED_BATCH = 40

export async function processIcalImportFeeds(): Promise<{
  processed: number
  succeeded: number
  failed: number
  skipped: number
  results: SyncFeedResult[]
}> {
  const admin = createAdminClient()
  const { data: feeds, error } = await admin
    .from('channel_ical_feeds')
    .select(
      'id, hotel_id, room_id, name, provider, direction, import_url, export_token, is_active, last_sync_at, last_sync_status, last_sync_message, events_synced, last_http_etag, last_content_hash, sync_lock_until',
    )
    .eq('direction', 'import')
    .eq('is_active', true)
    .order('last_sync_at', { ascending: true, nullsFirst: true })
    .limit(FEED_BATCH)

  if (error) throw error

  const results: SyncFeedResult[] = []
  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const feed of (feeds ?? []) as ChannelIcalFeedRow[]) {
    const result = await syncImportFeed(feed)
    results.push(result)
    if (result.skipped) skipped++
    else if (result.ok) succeeded++
    else failed++
  }

  return {
    processed: results.length,
    succeeded,
    failed,
    skipped,
    results,
  }
}

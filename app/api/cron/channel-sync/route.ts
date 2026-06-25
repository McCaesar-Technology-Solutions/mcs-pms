import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron/maintenance'
import { syncAllImportFeeds } from '@/lib/channels/sync-import'

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await syncAllImportFeeds()
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Channel sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

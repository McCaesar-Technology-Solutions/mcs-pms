import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron/maintenance'
import { processIcalImportFeeds } from '@/lib/cron/ical-sync'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processIcalImportFeeds()
    return NextResponse.json({
      ok: true,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'iCal sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

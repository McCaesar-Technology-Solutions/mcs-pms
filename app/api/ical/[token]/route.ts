import { NextResponse } from 'next/server'
import { buildExportICalForFeed, loadExportFeedByToken } from '@/lib/channels/sync-export'

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  if (!token?.trim()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const feed = await loadExportFeedByToken(token.trim())
  if (!feed) {
    return new NextResponse('Not found', { status: 404 })
  }

  const ical = await buildExportICalForFeed(feed)
  if (!ical) {
    return new NextResponse('Could not build calendar', { status: 500 })
  }

  return new NextResponse(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

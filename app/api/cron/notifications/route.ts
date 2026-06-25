import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron/maintenance'
import { processNotificationOutbox } from '@/lib/notifications/outbox'

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processNotificationOutbox()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Outbox processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

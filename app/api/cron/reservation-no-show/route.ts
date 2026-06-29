import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron/maintenance'
import { processNoShowReservations } from '@/lib/cron/reservation-lifecycle'

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processNoShowReservations()
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'No-show job failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

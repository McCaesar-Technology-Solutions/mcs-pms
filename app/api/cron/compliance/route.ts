import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron/maintenance'
import { processGtaLicenseAlerts } from '@/lib/compliance/gta-alerts-cron'

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processGtaLicenseAlerts()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Compliance job failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

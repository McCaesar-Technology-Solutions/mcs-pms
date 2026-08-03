import { NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron/maintenance'
import { reclaimStaleAccessJobs } from '@/lib/access/jobs'

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await reclaimStaleAccessJobs()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Access job reclaim failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

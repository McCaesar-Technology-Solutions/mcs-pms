import { NextResponse } from 'next/server'
import { authorizeCron, cleanupMfaChallenges, cleanupRateLimits } from '@/lib/cron/maintenance'

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [rateLimits, mfaChallenges] = await Promise.all([
      cleanupRateLimits(),
      cleanupMfaChallenges(),
    ])
    return NextResponse.json({
      ok: true,
      deleted: { rateLimits, mfaChallenges },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cleanup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

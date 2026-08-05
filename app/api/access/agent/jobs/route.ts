import { NextResponse } from 'next/server'
import { authenticateAccessAgent } from '@/lib/access/agent-auth'
import { claimAccessJobs, reclaimStaleAccessJobs } from '@/lib/access/jobs'
import { decryptAccessSecret } from '@/lib/access/crypto'
import type { AccessJobPayload, ProvisionJobPayload, AssignCardJobPayload } from '@/lib/access/types'

async function decryptJobPayload(payload: AccessJobPayload): Promise<AccessJobPayload> {
  if (!payload || typeof payload !== 'object') return payload
  if (!('doorPin' in payload) || !payload.doorPin || typeof payload.doorPin !== 'string') {
    return payload
  }
  const pin = await decryptAccessSecret(payload.doorPin)
  return { ...payload, doorPin: pin } as ProvisionJobPayload | AssignCardJobPayload
}

export async function POST(request: Request) {
  const auth = await authenticateAccessAgent(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let limit = 10
  try {
    const body = (await request.json()) as { limit?: number }
    if (typeof body.limit === 'number' && body.limit > 0) {
      limit = Math.min(Math.floor(body.limit), 50)
    }
  } catch {
    // empty body is fine
  }

  // Reclaim rarely here so unlock polls stay fast (full reclaim runs on heartbeat + cron).
  if (Math.random() < 0.05) {
    await reclaimStaleAccessJobs().catch(() => undefined)
  }

  const jobs = await claimAccessJobs({
    hotelId: auth.ctx.hotelId,
    agentId: auth.ctx.agentId,
    limit,
  })

  const decrypted = await Promise.all(
    jobs.map(async (job) => ({
      id: job.id,
      type: job.job_type,
      credentialId: job.credential_id,
      attempts: job.attempts,
      payload: await decryptJobPayload(job.payload),
    })),
  )

  return NextResponse.json({ jobs: decrypted })
}

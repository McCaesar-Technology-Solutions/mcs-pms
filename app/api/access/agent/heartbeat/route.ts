import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAccessAgent, touchAgentHeartbeat } from '@/lib/access/agent-auth'
import { reclaimStaleAccessJobs } from '@/lib/access/jobs'

const bodySchema = z.object({
  version: z.string().max(64).optional(),
  hostname: z.string().max(128).optional(),
  devices: z
    .array(
      z.object({
        deviceKey: z.string().min(1).max(64),
        label: z.string().max(120).optional(),
        model: z.string().max(120).nullable().optional(),
        serialNumber: z.string().max(120).nullable().optional(),
        firmware: z.string().max(120).nullable().optional(),
        online: z.boolean().optional(),
      }),
    )
    .max(50)
    .optional(),
})

export async function POST(request: Request) {
  const auth = await authenticateAccessAgent(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    json = {}
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid heartbeat payload.' }, { status: 400 })
  }

  await touchAgentHeartbeat({
    hotelId: auth.ctx.hotelId,
    version: parsed.data.version,
    hostname: parsed.data.hostname,
    devices: parsed.data.devices,
  })

  // Stuck-job reclaim on heartbeat keeps /jobs polls light for fast unlock.
  await reclaimStaleAccessJobs().catch(() => undefined)

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAccessAgent } from '@/lib/access/agent-auth'
import { completeAccessJob } from '@/lib/access/jobs'

const bodySchema = z.object({
  success: z.boolean(),
  error: z.string().max(2000).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateAccessAgent(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing job id.' }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid completion payload.' }, { status: 400 })
  }

  const result = await completeAccessJob({
    hotelId: auth.ctx.hotelId,
    jobId: id,
    success: parsed.data.success,
    error: parsed.data.error,
    result: parsed.data.result,
    agentId: auth.ctx.agentId,
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

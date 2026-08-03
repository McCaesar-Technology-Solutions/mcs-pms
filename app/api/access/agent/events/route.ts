import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateAccessAgent } from '@/lib/access/agent-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/types'

const eventSchema = z.object({
  deviceKey: z.string().max(64).optional(),
  doorNo: z.number().int().min(1).max(64).optional(),
  employeeNo: z.string().max(64).optional(),
  eventType: z.string().min(1).max(80),
  success: z.boolean().optional(),
  occurredAt: z.string().datetime().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
})

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(100),
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
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid events payload.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const rows = []

  for (const ev of parsed.data.events) {
    let guestId: string | null = null
    if (ev.employeeNo) {
      const { data: cred } = await admin
        .from('access_credentials')
        .select('guest_id')
        .eq('hotel_id', auth.ctx.hotelId)
        .eq('employee_no', ev.employeeNo)
        .maybeSingle()
      guestId = cred?.guest_id ?? null
    }

    rows.push({
      hotel_id: auth.ctx.hotelId,
      device_key: ev.deviceKey ?? null,
      door_no: ev.doorNo ?? null,
      employee_no: ev.employeeNo ?? null,
      guest_id: guestId,
      event_type: ev.eventType,
      success: ev.success ?? true,
      raw: (ev.raw ?? null) as Json | null,
      occurred_at: ev.occurredAt ?? new Date().toISOString(),
    })
  }

  const { error } = await admin.from('access_events').insert(rows)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, inserted: rows.length })
}

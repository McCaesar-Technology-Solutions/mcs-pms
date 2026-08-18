import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertRateLimit, ipRateKey } from '@/lib/rate-limit'
import { authorizeWebsiteSync } from '@/lib/website/authorize'
import { ingestWebsiteEnquiry } from '@/lib/website/ingest-enquiry'

export async function POST(request: Request) {
  if (!authorizeWebsiteSync(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limited = await assertRateLimit(
    ipRateKey('website-enquiry', request.headers.get('x-forwarded-for') ?? 'unknown'),
    { max: 40, windowMs: 15 * 60 * 1000, cooldownMs: 500 },
    'Too many booking requests. Try again shortly.',
  )
  if (limited) {
    return NextResponse.json({ error: limited }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const result = await ingestWebsiteEnquiry(createAdminClient(), body)
  if (!result.ok) {
    const status = result.code === 'UNMAPPED' ? 409 : result.code === 'INVALID' ? 400 : 422
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    reservationId: result.reservationId,
    hotelId: result.hotelId,
    roomId: result.roomId,
    status: result.status,
    reused: result.reused,
  })
}

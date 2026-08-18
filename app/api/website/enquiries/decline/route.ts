import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { authorizeWebsiteSync } from '@/lib/website/authorize'
import { declineWebsiteEnquiry } from '@/lib/website/ingest-enquiry'

const schema = z.object({ enquiryId: z.string().uuid() })

export async function POST(request: Request) {
  if (!authorizeWebsiteSync(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid enquiry id.' }, { status: 400 })
  }

  const result = await declineWebsiteEnquiry(createAdminClient(), parsed.data.enquiryId)
  if (!result.ok) {
    const status = result.code === 'NOT_FOUND' ? 404 : 422
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    reservationId: result.reservationId,
    reused: result.reused,
  })
}

import { createAdminClient } from '@/lib/supabase/admin'
import { sendToEmail } from '@/lib/notifications/send-email'
import { sendToPhone } from '@/lib/notifications/send'
import type { StaffEmailContent } from '@/lib/notifications/email-template'
import type { Json } from '@/lib/supabase/types'

const BATCH = 25

export async function processNotificationOutbox(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: rows } = await admin
    .from('notification_outbox')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)
    .order('created_at', { ascending: true })
    .limit(BATCH)

  if (!rows?.length) return { processed: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  for (const row of rows) {
    await admin
      .from('notification_outbox')
      .update({ status: 'processing', updated_at: now })
      .eq('id', row.id)

    const payload = row.payload as {
      body?: string
      emailContent?: StaffEmailContent
    }

    let ok = false
    let providerId: string | undefined
    let lastError: string | undefined

    try {
      if (row.channel === 'sms' || row.channel === 'whatsapp') {
        const results = await sendToPhone(row.recipient, payload.body ?? '', {
          hotelId: row.hotel_id ?? undefined,
          templateKey: row.template_key,
          includeWhatsApp: row.channel === 'whatsapp',
        })
        ok = results.some((r) => r.success)
        providerId = results.find((r) => r.success)?.providerId
        lastError = results.find((r) => !r.success)?.error
      } else if (row.channel === 'email' && payload.emailContent) {
        const result = await sendToEmail(row.recipient, payload.emailContent, {
          hotelId: row.hotel_id ?? undefined,
          templateKey: row.template_key,
        })
        ok = result.success
        providerId = result.providerId
        lastError = result.error
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Send failed'
    }

    const attempts = row.attempts + 1
    if (ok) {
      sent++
      await admin
        .from('notification_outbox')
        .update({
          status: 'sent',
          attempts,
          provider_id: providerId ?? null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    } else {
      failed++
      const dead = attempts >= row.max_attempts
      const backoffMs = Math.min(60_000 * attempts, 15 * 60_000)
      await admin
        .from('notification_outbox')
        .update({
          status: dead ? 'dead' : 'failed',
          attempts,
          last_error: lastError ?? 'Unknown error',
          next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }
  }

  return { processed: rows.length, sent, failed }
}

export async function enqueueSmsOutbox(input: {
  hotelId?: string
  phone: string
  body: string
  templateKey: string
  idempotencyKey?: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('notification_outbox').insert({
    hotel_id: input.hotelId ?? null,
    channel: 'sms',
    recipient: input.phone,
    template_key: input.templateKey,
    payload: { body: input.body },
    idempotency_key: input.idempotencyKey ?? null,
  })
}

export async function enqueueEmailOutbox(input: {
  hotelId?: string
  email: string
  content: StaffEmailContent
  templateKey: string
  idempotencyKey?: string
}): Promise<void> {
  const admin = createAdminClient()
  await admin.from('notification_outbox').insert({
    hotel_id: input.hotelId ?? null,
    channel: 'email',
    recipient: input.email,
    template_key: input.templateKey,
    payload: { emailContent: input.content } as unknown as Json,
    idempotency_key: input.idempotencyKey ?? null,
  })
}

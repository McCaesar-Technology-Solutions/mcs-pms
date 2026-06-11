import { createAdminClient } from '@/lib/supabase/admin'
import { toE164 } from '@/lib/notifications/e164'

export type NotificationChannel = 'sms' | 'whatsapp'

export interface SendResult {
  channel: NotificationChannel
  success: boolean
  providerId?: string
  error?: string
}

export interface NotifyOptions {
  hotelId?: string
  templateKey: string
  /** Send WhatsApp in addition to SMS when configured */
  includeWhatsApp?: boolean
}

function channelsEnabled(): NotificationChannel[] {
  const raw = process.env.NOTIFICATION_CHANNELS ?? 'sms,whatsapp'
  return raw
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is NotificationChannel => c === 'sms' || c === 'whatsapp')
}

function isConfigured(): boolean {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return true
  if (process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET) return true
  return false
}

async function sendTwilioSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_SMS_FROM
  if (!sid || !token || !from) {
    return { channel: 'sms', success: false, error: 'Twilio SMS not configured' }
  }

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = (await res.json()) as { sid?: string; message?: string }
  if (!res.ok) {
    return { channel: 'sms', success: false, error: data.message ?? `HTTP ${res.status}` }
  }
  return { channel: 'sms', success: true, providerId: data.sid }
}

async function sendTwilioWhatsApp(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const fromRaw = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'
  if (!sid || !token) {
    return { channel: 'whatsapp', success: false, error: 'Twilio WhatsApp not configured' }
  }

  const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  const params = new URLSearchParams({
    To: toWa,
    From: from,
    Body: body,
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = (await res.json()) as { sid?: string; message?: string }
  if (!res.ok) {
    return { channel: 'whatsapp', success: false, error: data.message ?? `HTTP ${res.status}` }
  }
  return { channel: 'whatsapp', success: true, providerId: data.sid }
}

async function sendHubtelSms(to: string, body: string): Promise<SendResult> {
  const clientId = process.env.HUBTEL_CLIENT_ID
  const clientSecret = process.env.HUBTEL_CLIENT_SECRET
  const sender = process.env.HUBTEL_SENDER_ID ?? 'MOJO'
  if (!clientId || !clientSecret) {
    return { channel: 'sms', success: false, error: 'Hubtel SMS not configured' }
  }

  const res = await fetch('https://smsc.hubtel.com/v1/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to,
      content: body,
    }),
  })

  const data = (await res.json()) as {
    messageId?: string
    status?: number
    statusDescription?: string | null
  }
  if (!res.ok || data.status !== 0) {
    return {
      channel: 'sms',
      success: false,
      error: data.statusDescription ?? `Hubtel HTTP ${res.status}`,
    }
  }
  return { channel: 'sms', success: true, providerId: data.messageId }
}

async function logNotification(
  opts: NotifyOptions,
  phone: string,
  channel: NotificationChannel,
  body: string,
  result: SendResult,
): Promise<void> {
  if (!opts.hotelId) return
  try {
    const admin = createAdminClient()
    await admin.from('notification_log').insert({
      hotel_id: opts.hotelId,
      recipient_phone: phone,
      channel,
      template_key: opts.templateKey,
      body,
      provider: process.env.TWILIO_ACCOUNT_SID
        ? 'twilio'
        : process.env.HUBTEL_CLIENT_ID
          ? 'hubtel'
          : 'none',
      provider_id: result.providerId ?? null,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error ?? null,
    })
  } catch {
    // Non-blocking
  }
}

export async function sendToPhone(
  rawPhone: string,
  body: string,
  opts: NotifyOptions,
): Promise<SendResult[]> {
  const e164 = toE164(rawPhone)
  if (!e164) return []

  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[notify:${opts.templateKey}] → ${e164}: ${body}`)
    }
    return [{ channel: 'sms', success: true, providerId: 'dev-log' }]
  }

  const enabled = channelsEnabled()
  const results: SendResult[] = []
  const useWhatsApp = opts.includeWhatsApp !== false && enabled.includes('whatsapp')

  if (enabled.includes('sms')) {
    const smsResult =
      process.env.HUBTEL_CLIENT_ID && !process.env.TWILIO_ACCOUNT_SID
        ? await sendHubtelSms(e164, body)
        : await sendTwilioSms(e164, body)
    results.push(smsResult)
    await logNotification(opts, e164, 'sms', body, smsResult)
  }

  if (useWhatsApp && process.env.TWILIO_ACCOUNT_SID) {
    const waResult = await sendTwilioWhatsApp(e164, body)
    results.push(waResult)
    await logNotification(opts, e164, 'whatsapp', body, waResult)
  }

  return results
}

export async function notifyPhones(
  phones: string[],
  body: string,
  opts: NotifyOptions,
): Promise<void> {
  const unique = [...new Set(phones.map((p) => toE164(p)).filter(Boolean))]
  await Promise.all(unique.map((phone) => sendToPhone(phone, body, opts)))
}

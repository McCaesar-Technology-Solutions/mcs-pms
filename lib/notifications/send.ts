import { isProd } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { toE164 } from '@/lib/notifications/e164'
import {
  resolveArkeselSenderId,
  toArkeselRecipient,
  validateArkeselSenderId,
} from '@/lib/notifications/arkesel-sender'
import { resolveHubtelSenderId, validateHubtelSenderId } from '@/lib/notifications/hubtel-sender'
import { isSmsConfigured, resolveSmsProvider, type SmsProvider } from '@/lib/notifications/sms-provider'
import { shouldSendHotelNotification } from '@/lib/notifications/recipients'

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
  const raw = process.env.NOTIFICATION_CHANNELS?.trim()
  if (raw) {
    return raw
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter((c): c is NotificationChannel => c === 'sms' || c === 'whatsapp')
  }

  // Arkesel/Hubtel are SMS-only — include WhatsApp only when Twilio is configured.
  const hasTwilio = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  return hasTwilio ? ['sms', 'whatsapp'] : ['sms']
}

/** Exposed for tests — which outbound channels are active. */
export function resolveNotificationChannels(): NotificationChannel[] {
  return channelsEnabled()
}

function isConfigured(): boolean {
  return isSmsConfigured()
}

async function sendArkeselSms(to: string, body: string): Promise<SendResult> {
  const apiKey = process.env.ARKESEL_API_KEY
  const sender = resolveArkeselSenderId()
  if (!apiKey) {
    return { channel: 'sms', success: false, error: 'Arkesel SMS not configured' }
  }

  const senderCheck = validateArkeselSenderId(sender)
  if (!senderCheck.ok) {
    return { channel: 'sms', success: false, error: senderCheck.error }
  }

  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      message: body,
      recipients: [toArkeselRecipient(to)],
    }),
  })

  const data = (await res.json()) as {
    status?: string
    message?: string
    data?: Array<{ id?: string; recipient?: string }>
  }

  if (!res.ok || data.status !== 'success') {
    return {
      channel: 'sms',
      success: false,
      error: data.message ?? `Arkesel HTTP ${res.status}`,
    }
  }

  const messageId = data.data?.[0]?.id
  return { channel: 'sms', success: true, providerId: messageId }
}

async function sendSmsViaProvider(provider: SmsProvider, to: string, body: string): Promise<SendResult> {
  switch (provider) {
    case 'arkesel':
      return sendArkeselSms(to, body)
    case 'hubtel':
      return sendHubtelSms(to, body)
    case 'twilio':
      return sendTwilioSms(to, body)
    default:
      return { channel: 'sms', success: false, error: 'No SMS provider configured' }
  }
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
  const sender = resolveHubtelSenderId()
  if (!clientId || !clientSecret) {
    return { channel: 'sms', success: false, error: 'Hubtel SMS not configured' }
  }

  const senderCheck = validateHubtelSenderId(sender)
  if (!senderCheck.ok) {
    return { channel: 'sms', success: false, error: senderCheck.error }
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
  result: SendResult & { status?: 'sent' | 'failed' | 'skipped' },
): Promise<void> {
  if (!opts.hotelId) return
  try {
    const admin = createAdminClient()
    const status =
      result.status ??
      (result.providerId === 'skipped-pref'
        ? 'skipped'
        : result.success
          ? 'sent'
          : 'failed')
    await admin.from('notification_log').insert({
      hotel_id: opts.hotelId,
      recipient_phone: phone,
      channel,
      template_key: opts.templateKey,
      body,
      provider: status === 'skipped' ? 'pref' : resolveSmsProvider(),
      provider_id: result.providerId ?? null,
      status,
      error_message:
        status === 'skipped' ? 'Disabled in notification settings' : (result.error ?? null),
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

  if (!(await shouldSendHotelNotification(opts.hotelId, opts.templateKey))) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[notify:${opts.templateKey}] skipped (disabled for hotel)`)
    }
    const skipped: SendResult = { channel: 'sms', success: true, providerId: 'skipped-pref' }
    if (opts.hotelId) {
      await logNotification(opts, e164, 'sms', body, { ...skipped, status: 'skipped' })
    }
    return [skipped]
  }

  if (!isConfigured()) {
    if (isProd()) {
      const failed: SendResult = {
        channel: 'sms',
        success: false,
        error: 'SMS provider is not configured',
      }
      if (opts.hotelId) {
        await logNotification(opts, e164, 'sms', body, failed)
      }
      return [failed]
    }
    if (process.env.NODE_ENV === 'development') {
      console.info(`[notify:${opts.templateKey}] → ${e164}: ${body}`)
    }
    return [{ channel: 'sms', success: true, providerId: 'dev-log' }]
  }

  const enabled = channelsEnabled()
  const results: SendResult[] = []
  const useWhatsApp = opts.includeWhatsApp !== false && enabled.includes('whatsapp')

  if (enabled.includes('sms')) {
    const provider = resolveSmsProvider()
    const smsResult = await sendSmsViaProvider(provider, e164, body)
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

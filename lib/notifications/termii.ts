export const DEFAULT_TERMII_BASE_URL = 'https://api.ng.termii.com'

export interface TermiiSendResult {
  success: boolean
  messageId?: string
  error?: string
}

export function resolveTermiiBaseUrl(): string {
  const raw = process.env.TERMII_BASE_URL?.trim()
  return raw || DEFAULT_TERMII_BASE_URL
}

export function isTermiiConfigured(): boolean {
  return Boolean(process.env.TERMII_API_KEY?.trim())
}

/** WhatsApp device / sender name from the Termii dashboard. */
export function resolveTermiiWhatsAppSender(): string {
  return (process.env.TERMII_WHATSAPP_SENDER ?? '').trim()
}

export function isTermiiWhatsAppConfigured(): boolean {
  return isTermiiConfigured() && Boolean(resolveTermiiWhatsAppSender())
}

/** Termii expects international format without a leading + (e.g. 233244123456). */
export function toTermiiRecipient(e164: string): string {
  return e164.replace(/^\+/, '')
}

export function isWhatsAppNotificationsConfigured(): boolean {
  return (
    isTermiiWhatsAppConfigured() ||
    Boolean(process.env.TWILIO_ACCOUNT_SID?.trim() && process.env.TWILIO_AUTH_TOKEN?.trim())
  )
}

/** Prefer Termii WhatsApp over Twilio Verify for phone MFA when configured. */
export function shouldUseTwilioVerifyForPhone(): boolean {
  return (
    Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim() &&
        process.env.TWILIO_VERIFY_SERVICE_SID?.trim(),
    ) && !isTermiiWhatsAppConfigured()
  )
}

export function resolvePhoneDeliveryChannel(): 'sms' | 'whatsapp' {
  const raw = process.env.NOTIFICATION_CHANNELS?.trim().toLowerCase()
  if (raw) {
    const channels = raw.split(',').map((c) => c.trim())
    if (channels.includes('whatsapp')) return 'whatsapp'
    return 'sms'
  }
  if (isTermiiWhatsAppConfigured()) return 'whatsapp'
  return 'sms'
}

export function phoneVerifyChannelLabel(channel: 'sms' | 'whatsapp'): string {
  return channel === 'whatsapp' ? 'WhatsApp' : 'SMS'
}

/** Send a WhatsApp message via Termii (WhatsApp channel only — SMS uses Arkesel). */
export async function sendTermiiWhatsApp(e164: string, body: string): Promise<TermiiSendResult> {
  const apiKey = process.env.TERMII_API_KEY?.trim()
  const sender = resolveTermiiWhatsAppSender()

  if (!apiKey) {
    return { success: false, error: 'Termii not configured' }
  }
  if (!sender) {
    return {
      success: false,
      error: 'Termii WhatsApp sender not configured (set TERMII_WHATSAPP_SENDER)',
    }
  }

  const res = await fetch(`${resolveTermiiBaseUrl()}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      to: toTermiiRecipient(e164),
      from: sender,
      sms: body,
      type: 'plain',
      channel: 'whatsapp',
    }),
  })

  const data = (await res.json()) as {
    code?: string
    message?: string
    message_id?: string
    message_id_str?: string
  }

  if (!res.ok || data.code !== 'ok') {
    return { success: false, error: data.message ?? `Termii HTTP ${res.status}` }
  }

  return { success: true, messageId: data.message_id_str ?? data.message_id }
}

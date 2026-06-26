import { resolveNotificationChannels } from '@/lib/notifications/send'

export type TwilioVerifyChannel = 'sms' | 'whatsapp' | 'email'

export function isTwilioVerifyConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_VERIFY_SERVICE_SID?.trim(),
  )
}

/** Prefer WhatsApp for phone codes when Twilio WhatsApp is enabled. */
export function resolvePhoneVerifyChannel(): Extract<TwilioVerifyChannel, 'sms' | 'whatsapp'> {
  const channels = resolveNotificationChannels()
  if (channels.includes('whatsapp')) return 'whatsapp'
  return 'sms'
}

function twilioAuthHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim()
  const token = process.env.TWILIO_AUTH_TOKEN!.trim()
  return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`
}

function verifyServiceSid(): string {
  return process.env.TWILIO_VERIFY_SERVICE_SID!.trim()
}

export interface TwilioVerifySendResult {
  success: boolean
  sid?: string
  error?: string
}

export interface TwilioVerifyCheckResult {
  success: boolean
  error?: string
}

/** Start a Twilio Verify challenge (SMS, WhatsApp, or email). */
export async function sendTwilioVerification(
  to: string,
  channel: TwilioVerifyChannel,
): Promise<TwilioVerifySendResult> {
  if (!isTwilioVerifyConfigured()) {
    return { success: false, error: 'Twilio Verify is not configured.' }
  }

  const params = new URLSearchParams({
    To: to,
    Channel: channel,
  })

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid()}/Verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: twilioAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  )

  const data = (await res.json()) as {
    sid?: string
    status?: string
    message?: string
  }

  if (!res.ok) {
    return {
      success: false,
      error: data.message ?? `Twilio Verify HTTP ${res.status}`,
    }
  }

  if (data.status === 'failed') {
    return { success: false, error: data.message ?? 'Could not send the verification code.' }
  }

  return { success: true, sid: data.sid }
}

/** Confirm a Twilio Verify code for the same destination used in send. */
export async function checkTwilioVerification(
  to: string,
  code: string,
): Promise<TwilioVerifyCheckResult> {
  if (!isTwilioVerifyConfigured()) {
    return { success: false, error: 'Twilio Verify is not configured.' }
  }

  const params = new URLSearchParams({
    To: to,
    Code: code.trim(),
  })

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid()}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: twilioAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  )

  const data = (await res.json()) as {
    status?: string
    message?: string
  }

  if (!res.ok) {
    return {
      success: false,
      error: data.message ?? `Twilio Verify HTTP ${res.status}`,
    }
  }

  if (data.status === 'approved') {
    return { success: true }
  }

  return { success: false, error: 'Invalid or expired code. Request a new one and try again.' }
}

export function twilioVerifyChannelLabel(
  channel: Extract<TwilioVerifyChannel, 'sms' | 'whatsapp' | 'email'>,
): string {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'email') return 'email'
  return 'SMS'
}

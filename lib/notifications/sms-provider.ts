export type SmsProvider = 'arkesel' | 'hubtel' | 'twilio' | 'none'

/** Which SMS backend to use (explicit SMS_PROVIDER or auto-detect from env). Termii is WhatsApp-only. */
export function resolveSmsProvider(): SmsProvider {
  const explicit = process.env.SMS_PROVIDER?.trim().toLowerCase()

  if (explicit === 'arkesel' && process.env.ARKESEL_API_KEY) return 'arkesel'
  if (explicit === 'hubtel' && process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET) {
    return 'hubtel'
  }
  if (explicit === 'twilio' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return 'twilio'
  }

  // Ghana-first default: Arkesel → Hubtel → Twilio (Termii is never used for SMS)
  if (process.env.ARKESEL_API_KEY) return 'arkesel'
  if (process.env.HUBTEL_CLIENT_ID && process.env.HUBTEL_CLIENT_SECRET) return 'hubtel'
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return 'twilio'

  return 'none'
}

export function isSmsConfigured(): boolean {
  return resolveSmsProvider() !== 'none'
}

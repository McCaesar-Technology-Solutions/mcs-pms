import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { isTermiiWhatsAppConfigured } from '@/lib/notifications/termii'

export type MfaPhoneChannel = 'sms' | 'whatsapp'

/**
 * WhatsApp MFA OTP delivery is unreliable right now — hide the option from the UI
 * and do not offer it as a verification channel until Termii auth templates work.
 */
const MFA_WHATSAPP_ENABLED = false

/** Phone MFA channels available from configured providers (Arkesel SMS, Termii WhatsApp). */
export function resolveMfaPhoneChannels(): MfaPhoneChannel[] {
  const channels: MfaPhoneChannel[] = []
  if (isSmsConfigured()) channels.push('sms')
  if (MFA_WHATSAPP_ENABLED && isTermiiWhatsAppConfigured()) channels.push('whatsapp')
  return channels
}

export function isMfaPhoneChannel(value: string): value is MfaPhoneChannel {
  return value === 'sms' || value === 'whatsapp'
}

export function resolveMfaPhoneChannel(
  requested?: string | null,
): MfaPhoneChannel | { error: string } {
  const available = resolveMfaPhoneChannels()
  if (available.length === 0) {
    return { error: 'No phone verification channels are configured on this server.' }
  }

  if (requested && isMfaPhoneChannel(requested)) {
    if (!available.includes(requested)) {
      return {
        error:
          requested === 'whatsapp'
            ? 'WhatsApp verification is not available. Try SMS instead.'
            : 'SMS verification is not available. Try WhatsApp instead.',
      }
    }
    return requested
  }

  // Prefer SMS for one-time codes — more reliable than WhatsApp for MFA.
  if (available.includes('sms')) return 'sms'
  if (available.includes('whatsapp')) return 'whatsapp'
  return available[0]!
}

export function mfaPhoneChannelLabel(channel: MfaPhoneChannel): string {
  return channel === 'whatsapp' ? 'WhatsApp' : 'SMS'
}

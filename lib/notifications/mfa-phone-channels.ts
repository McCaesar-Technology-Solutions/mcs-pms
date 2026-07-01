import { isSmsConfigured } from '@/lib/notifications/sms-provider'
import { isTermiiWhatsAppConfigured } from '@/lib/notifications/termii'

export type MfaPhoneChannel = 'sms' | 'whatsapp'

/** Phone MFA channels available from configured providers (Arkesel SMS, Termii WhatsApp). */
export function resolveMfaPhoneChannels(): MfaPhoneChannel[] {
  const channels: MfaPhoneChannel[] = []
  if (isSmsConfigured()) channels.push('sms')
  if (isTermiiWhatsAppConfigured()) channels.push('whatsapp')
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

  if (available.includes('whatsapp')) return 'whatsapp'
  return available[0]!
}

export function mfaPhoneChannelLabel(channel: MfaPhoneChannel): string {
  return channel === 'whatsapp' ? 'WhatsApp' : 'SMS'
}

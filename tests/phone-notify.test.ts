import { afterEach, describe, expect, it, vi } from 'vitest'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'

describe('phoneNotifyOpts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('includes WhatsApp only when a provider is configured', () => {
    vi.stubEnv('TERMII_API_KEY', '')
    vi.stubEnv('TERMII_WHATSAPP_SENDER', '')
    vi.stubEnv('TWILIO_ACCOUNT_SID', '')
    expect(phoneNotifyOpts('complaint_assigned', { hotelId: 'hotel-1' })).toEqual({
      templateKey: 'complaint_assigned',
      includeWhatsApp: false,
      hotelId: 'hotel-1',
    })

    vi.stubEnv('TERMII_API_KEY', 'termii-key')
    vi.stubEnv('TERMII_WHATSAPP_SENDER', 'MOJO')
    expect(phoneNotifyOpts('complaint_assigned', { hotelId: 'hotel-1' }).includeWhatsApp).toBe(
      true,
    )
  })

  it('allows overrides such as onlyChannels for MFA', () => {
    vi.stubEnv('TERMII_API_KEY', 'termii-key')
    vi.stubEnv('TERMII_WHATSAPP_SENDER', 'MOJO')
    expect(
      phoneNotifyOpts('mfa_otp', {
        hotelId: 'hotel-1',
        onlyChannels: ['whatsapp'],
      }),
    ).toEqual({
      templateKey: 'mfa_otp',
      includeWhatsApp: true,
      hotelId: 'hotel-1',
      onlyChannels: ['whatsapp'],
    })
  })
})

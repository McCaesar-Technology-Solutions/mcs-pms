import { describe, expect, it } from 'vitest'
import { phoneNotifyOpts } from '@/lib/notifications/phone-notify'

describe('phoneNotifyOpts', () => {
  it('enables WhatsApp alongside SMS by default', () => {
    expect(phoneNotifyOpts('complaint_assigned', { hotelId: 'hotel-1' })).toEqual({
      templateKey: 'complaint_assigned',
      includeWhatsApp: true,
      hotelId: 'hotel-1',
    })
  })

  it('allows overrides such as onlyChannels for MFA', () => {
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

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/notifications/recipients', () => ({
  shouldSendHotelNotification: async () => true,
}))

describe('MFA WhatsApp onlyChannels vs NOTIFICATION_CHANNELS', () => {
  afterEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('still targets WhatsApp when NOTIFICATION_CHANNELS is sms-only', async () => {
    vi.stubEnv('NOTIFICATION_CHANNELS', 'sms')
    vi.stubEnv('TERMII_API_KEY', 'termii-key')
    vi.stubEnv('TERMII_WHATSAPP_SENDER', 'device-1')
    vi.stubEnv('ARKESEL_API_KEY', 'arkesel')
    vi.stubEnv('ARKESEL_SENDER_ID', 'MOJO')

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ code: 'ok', message_id_str: 'wa-1' }), { status: 200 }),
    )

    const { sendToPhone } = await import('@/lib/notifications/send')
    const results = await sendToPhone('+233201234567', 'Your code is 123456', {
      templateKey: 'mfa_otp',
      onlyChannels: ['whatsapp'],
      whatsappOtpCode: '123456',
    })

    expect(results).toHaveLength(1)
    expect(results[0]?.channel).toBe('whatsapp')
    expect(results[0]?.success).toBe(true)
    expect(fetchMock).toHaveBeenCalled()
  })
})

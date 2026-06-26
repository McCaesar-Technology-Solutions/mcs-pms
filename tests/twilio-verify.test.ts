import { describe, expect, it, afterEach, vi } from 'vitest'

describe('Twilio Verify', () => {
  const env = process.env

  afterEach(() => {
    process.env = env
    vi.restoreAllMocks()
  })

  it('detects when Verify is configured', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_VERIFY_SERVICE_SID

    const mod = await import('@/lib/notifications/twilio-verify')
    expect(mod.isTwilioVerifyConfigured()).toBe(false)

    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'secret'
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA123'

    expect(mod.isTwilioVerifyConfigured()).toBe(true)
  })

  it('prefers WhatsApp when notification channels include it', async () => {
    process.env.NOTIFICATION_CHANNELS = 'sms,whatsapp'
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'secret'

    const { resolvePhoneVerifyChannel } = await import('@/lib/notifications/twilio-verify')
    expect(resolvePhoneVerifyChannel()).toBe('whatsapp')
  })

  it('sends and checks verification codes via the Verify API', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN = 'secret'
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA123'

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sid: 'VE123', status: 'pending' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'approved' }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const { sendTwilioVerification, checkTwilioVerification } = await import(
      '@/lib/notifications/twilio-verify'
    )

    const sent = await sendTwilioVerification('+233201234567', 'whatsapp')
    expect(sent.success).toBe(true)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/Verifications')

    const checked = await checkTwilioVerification('+233201234567', '123456')
    expect(checked.success).toBe(true)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/VerificationCheck')
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  isTermiiWhatsAppConfigured,
  resolvePhoneDeliveryChannel,
  sendTermiiWhatsApp,
  shouldUseTwilioVerifyForPhone,
  toTermiiRecipient,
} from '@/lib/notifications/termii'

describe('toTermiiRecipient', () => {
  it('strips the leading plus from E.164 numbers', () => {
    expect(toTermiiRecipient('+233241234567')).toBe('233241234567')
  })
})

describe('Termii WhatsApp configuration', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.TERMII_API_KEY
    delete process.env.TERMII_WHATSAPP_SENDER
    delete process.env.TERMII_SENDER_ID
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_VERIFY_SERVICE_SID
    delete process.env.NOTIFICATION_CHANNELS
  })

  afterEach(() => {
    process.env = env
    vi.restoreAllMocks()
  })

  it('requires API key and TERMII_WHATSAPP_SENDER (not SMS sender)', () => {
    expect(isTermiiWhatsAppConfigured()).toBe(false)
    process.env.TERMII_API_KEY = 'key'
    expect(isTermiiWhatsAppConfigured()).toBe(false)
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
    expect(isTermiiWhatsAppConfigured()).toBe(true)
  })

  it('prefers Termii over Twilio Verify for phone MFA', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    process.env.TWILIO_VERIFY_SERVICE_SID = 'VA'
    expect(shouldUseTwilioVerifyForPhone()).toBe(true)

    process.env.TERMII_API_KEY = 'key'
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
    expect(shouldUseTwilioVerifyForPhone()).toBe(false)
  })

  it('defaults phone delivery to WhatsApp when Termii WhatsApp is configured', () => {
    process.env.TERMII_API_KEY = 'key'
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
    expect(resolvePhoneDeliveryChannel()).toBe('whatsapp')
  })
})

describe('sendTermiiWhatsApp', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.TERMII_API_KEY = 'test-key'
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
    process.env.TERMII_BASE_URL = 'https://api.example.test'
  })

  afterEach(() => {
    process.env = env
    vi.restoreAllMocks()
  })

  it('posts to the Termii messaging API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ok',
          message_id_str: 'msg-123',
          message: 'Successfully Sent',
        }),
        { status: 200 },
      ),
    )

    const result = await sendTermiiWhatsApp('+233201234567', 'Hello from MOJO')
    expect(result.success).toBe(true)
    expect(result.messageId).toBe('msg-123')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/sms/send',
      expect.objectContaining({ method: 'POST' }),
    )

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body).toMatchObject({
      api_key: 'test-key',
      to: '233201234567',
      from: 'MOJO',
      sms: 'Hello from MOJO',
      channel: 'whatsapp',
      type: 'plain',
    })
  })
})

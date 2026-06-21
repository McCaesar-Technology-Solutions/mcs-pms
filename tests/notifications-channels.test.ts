import { describe, expect, it, afterEach } from 'vitest'

describe('notification channel defaults', () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it('uses sms only when Twilio is not configured', async () => {
    delete process.env.NOTIFICATION_CHANNELS
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN

    const { resolveNotificationChannels } = await import('@/lib/notifications/send')
    expect(resolveNotificationChannels()).toEqual(['sms'])
  })

  it('includes whatsapp when Twilio is configured', async () => {
    delete process.env.NOTIFICATION_CHANNELS
    process.env.TWILIO_ACCOUNT_SID = 'sid'
    process.env.TWILIO_AUTH_TOKEN = 'token'

    const { resolveNotificationChannels } = await import('@/lib/notifications/send')
    expect(resolveNotificationChannels()).toEqual(['sms', 'whatsapp'])
  })
})

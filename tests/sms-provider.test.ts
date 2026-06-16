import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { toArkeselRecipient } from '@/lib/notifications/arkesel-sender'
import { resolveSmsProvider } from '@/lib/notifications/sms-provider'

describe('toArkeselRecipient', () => {
  it('strips the leading plus from E.164 numbers', () => {
    expect(toArkeselRecipient('+233241234567')).toBe('233241234567')
  })
})

describe('resolveSmsProvider', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.SMS_PROVIDER
    delete process.env.ARKESEL_API_KEY
    delete process.env.HUBTEL_CLIENT_ID
    delete process.env.HUBTEL_CLIENT_SECRET
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
  })

  afterEach(() => {
    process.env = env
  })

  it('prefers Arkesel when its API key is set', () => {
    process.env.ARKESEL_API_KEY = 'test-key'
    process.env.HUBTEL_CLIENT_ID = 'hubtel-id'
    process.env.HUBTEL_CLIENT_SECRET = 'hubtel-secret'
    expect(resolveSmsProvider()).toBe('arkesel')
  })

  it('falls back to Hubtel when only Hubtel is configured', () => {
    process.env.HUBTEL_CLIENT_ID = 'hubtel-id'
    process.env.HUBTEL_CLIENT_SECRET = 'hubtel-secret'
    expect(resolveSmsProvider()).toBe('hubtel')
  })

  it('honours SMS_PROVIDER=hubtel when Hubtel credentials exist', () => {
    process.env.SMS_PROVIDER = 'hubtel'
    process.env.ARKESEL_API_KEY = 'test-key'
    process.env.HUBTEL_CLIENT_ID = 'hubtel-id'
    process.env.HUBTEL_CLIENT_SECRET = 'hubtel-secret'
    expect(resolveSmsProvider()).toBe('hubtel')
  })
})

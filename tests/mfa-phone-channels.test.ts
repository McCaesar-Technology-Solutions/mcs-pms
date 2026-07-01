import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  mfaPhoneChannelLabel,
  resolveMfaPhoneChannel,
  resolveMfaPhoneChannels,
} from '@/lib/notifications/mfa-phone-channels'

describe('resolveMfaPhoneChannels', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.ARKESEL_API_KEY
    delete process.env.TERMII_API_KEY
    delete process.env.TERMII_WHATSAPP_SENDER
  })

  afterEach(() => {
    process.env = env
  })

  it('exposes SMS and WhatsApp when both providers are configured', () => {
    process.env.ARKESEL_API_KEY = 'arkesel'
    process.env.TERMII_API_KEY = 'termii'
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
    expect(resolveMfaPhoneChannels()).toEqual(['sms', 'whatsapp'])
  })

  it('exposes only SMS when Termii WhatsApp is not configured', () => {
    process.env.ARKESEL_API_KEY = 'arkesel'
    expect(resolveMfaPhoneChannels()).toEqual(['sms'])
  })
})

describe('resolveMfaPhoneChannel', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    process.env.ARKESEL_API_KEY = 'arkesel'
    process.env.TERMII_API_KEY = 'termii'
    process.env.TERMII_WHATSAPP_SENDER = 'MOJO'
  })

  afterEach(() => {
    process.env = env
  })

  it('honours the requested channel when available', () => {
    expect(resolveMfaPhoneChannel('sms')).toBe('sms')
    expect(resolveMfaPhoneChannel('whatsapp')).toBe('whatsapp')
  })

  it('rejects unavailable channels', () => {
    delete process.env.TERMII_API_KEY
    delete process.env.TERMII_WHATSAPP_SENDER
    const result = resolveMfaPhoneChannel('whatsapp')
    expect(result).toEqual({ error: 'WhatsApp verification is not available. Try SMS instead.' })
  })

  it('defaults to SMS when both channels are available', () => {
    expect(resolveMfaPhoneChannel()).toBe('sms')
  })

  it('labels channels for user-facing copy', () => {
    expect(mfaPhoneChannelLabel('sms')).toBe('SMS')
    expect(mfaPhoneChannelLabel('whatsapp')).toBe('WhatsApp')
  })
})

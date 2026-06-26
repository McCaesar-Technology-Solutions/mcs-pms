import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  smsGuestEnterUrl,
  smsInviteUrl,
  smsLine,
  smsRoom,
  smsShortDate,
  smsTruncate,
  smsUrl,
} from '@/lib/notifications/sms-format'

describe('sms-format', () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://mcs-pms.vercel.app'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = prev
  })

  it('strips protocol from app URLs', () => {
    expect(smsUrl('/guest')).toBe('mcs-pms.vercel.app/guest')
  })

  it('builds compact guest enter links', () => {
    expect(smsGuestEnterUrl('abc-123')).toBe('mcs-pms.vercel.app/guest/enter?t=abc-123')
  })

  it('builds compact invite links', () => {
    expect(smsInviteUrl('tok')).toBe('mcs-pms.vercel.app/accept-invite?t=tok')
  })

  it('formats short dates', () => {
    expect(smsShortDate('2026-06-26')).toMatch(/26 Jun/)
  })

  it('formats room shorthand', () => {
    expect(smsRoom('4')).toBe('Rm 4')
    expect(smsRoom(null)).toBe('Rm TBC')
  })

  it('truncates long text', () => {
    expect(smsTruncate('hello world', 8)).toBe('hello w…')
  })

  it('joins parts into one line', () => {
    expect(smsLine('MOJO:', 'Welcome', null, 'Ivan')).toBe('MOJO: Welcome Ivan')
  })
})

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { normalizeEmailFromHeader } from '@/lib/notifications/email-provider'
import { reportNotificationFailure } from '@/lib/notifications/notify-failure'

describe('notification dispatch helpers', () => {
  it('normalizes resend from headers with stray spaces', () => {
    expect(normalizeEmailFromHeader('MOJO <onboarding@resend.dev >')).toBe(
      'MOJO <onboarding@resend.dev>',
    )
  })

  it('reports notification failures without throwing', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      reportNotificationFailure({
        templateKey: 'complaint_submitted',
        channel: 'sms',
        recipient: '+233200000000',
        error: 'provider timeout',
        stage: 'outbox_retry',
      }),
    ).not.toThrow()
    errorSpy.mockRestore()
  })
})

describe('notifyPhones outbox enqueue', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...env }
    process.env.ARKESEL_API_KEY = ''
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env = env
    vi.restoreAllMocks()
  })

  it('enqueues failed sms when provider is not configured in production', async () => {
    const outboxRows: Record<string, unknown>[] = []
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: (table: string) => ({
          insert: (row: Record<string, unknown>) => {
            if (table === 'notification_outbox') outboxRows.push(row)
            return Promise.resolve({ error: null })
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null }),
            }),
          }),
        }),
      }),
    }))
    vi.doMock('@/lib/notifications/recipients', () => ({
      shouldSendHotelNotification: async () => true,
    }))

    const { notifyPhones } = await import('@/lib/notifications/send')
    await notifyPhones(['0241234567'], 'Test body', {
      hotelId: 'hotel-1',
      templateKey: 'complaint_submitted',
    })

    expect(outboxRows).toHaveLength(1)
    expect(outboxRows[0]?.channel).toBe('sms')
    expect(outboxRows[0]?.template_key).toBe('complaint_submitted')
    expect(String(outboxRows[0]?.recipient)).toMatch(/^\+233/)
  })
})

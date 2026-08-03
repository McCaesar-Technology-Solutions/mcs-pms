import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertMock = vi.fn()
const hotelRow = { access_control_enabled: true }
const integrationRow = { enabled: true }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'hotels') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: hotelRow }),
            }),
          }),
        }
      }
      if (table === 'access_integrations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: integrationRow }),
            }),
          }),
        }
      }
      if (table === 'access_jobs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          }),
          insert: (row: unknown) => {
            insertMock(row)
            return {
              select: () => ({
                single: async () => ({ data: { id: 'job-1' }, error: null }),
              }),
            }
          },
        }
      }
      return {}
    },
  }),
}))

import { enqueueAccessJob, isAccessControlEnabled } from '@/lib/access/jobs'

describe('access jobs enqueue', () => {
  beforeEach(() => {
    insertMock.mockClear()
    hotelRow.access_control_enabled = true
    integrationRow.enabled = true
  })

  it('skips enqueue when access control is disabled', async () => {
    hotelRow.access_control_enabled = false
    const result = await enqueueAccessJob({
      hotelId: 'hotel-1',
      jobType: 'unlock',
      payload: { deviceKey: 'lobby', doorNo: 1, label: 'Lobby' },
    })
    expect(result).toEqual({ skipped: true })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('enqueues when hotel flag and integration are enabled', async () => {
    expect(await isAccessControlEnabled('hotel-1')).toBe(true)

    const result = await enqueueAccessJob({
      hotelId: 'hotel-1',
      jobType: 'unlock',
      payload: { deviceKey: 'lobby', doorNo: 1, label: 'Lobby' },
    })

    expect(result).toEqual({ id: 'job-1' })
    expect(insertMock).toHaveBeenCalled()
    const row = insertMock.mock.calls[0][0] as { job_type: string; priority: number }
    expect(row.job_type).toBe('unlock')
    expect(row.priority).toBe(10)
  })
})

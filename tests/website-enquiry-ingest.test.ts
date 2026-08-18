import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWebsiteEnquiryIngest } from '@/lib/website/ingest-enquiry'
import { authorizeWebsiteSync } from '@/lib/website/authorize'

vi.mock('@/lib/env', () => ({
  getWebsiteSyncSecret: () => 'website-sync-secret-16',
}))

const ENQUIRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PROPERTY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('parseWebsiteEnquiryIngest', () => {
  it('accepts a valid website enquiry', () => {
    const parsed = parseWebsiteEnquiryIngest({
      enquiryId: ENQUIRY_ID,
      propertyId: PROPERTY_ID,
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
      guests: 2,
      fullName: 'Ama Mensah',
      email: 'ama@example.com',
      phone: '0244123456',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid dates and missing name', () => {
    expect(
      parseWebsiteEnquiryIngest({
        enquiryId: ENQUIRY_ID,
        propertyId: PROPERTY_ID,
        checkIn: '01-09-2026',
        checkOut: '2026-09-04',
        guests: 2,
        fullName: 'Ama Mensah',
        email: 'ama@example.com',
        phone: '0244123456',
      }).success,
    ).toBe(false)
  })
})

describe('authorizeWebsiteSync', () => {
  it('accepts a matching bearer token', () => {
    const request = new Request('http://localhost/api/website/enquiries', {
      headers: { authorization: 'Bearer website-sync-secret-16' },
    })
    expect(authorizeWebsiteSync(request)).toBe(true)
  })

  it('rejects a wrong token', () => {
    const request = new Request('http://localhost/api/website/enquiries', {
      headers: { authorization: 'Bearer other-secret-16xxxx' },
    })
    expect(authorizeWebsiteSync(request)).toBe(false)
  })
})

describe('ingestWebsiteEnquiry', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns UNMAPPED when the listing is not linked', async () => {
    vi.doMock('@/lib/reservations/state-machine', () => ({
      transitionReservation: vi.fn(),
    }))
    vi.doMock('@/lib/pricing/room-rates', () => ({
      getRoomRates: vi.fn(),
    }))
    vi.doMock('@/lib/data/occupancy', () => ({
      findAvailableRooms: vi.fn(),
      roomHasClash: vi.fn(),
    }))
    vi.doMock('@/lib/audit/log', () => ({ writeAuditLog: vi.fn() }))
    vi.doMock('@/lib/notifications/notify-task', () => ({ runNotifyTask: vi.fn() }))

    const { ingestWebsiteEnquiry } = await import('@/lib/website/ingest-enquiry')

    const admin = {
      from: (table: string) => {
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
          }
        }
        if (table === 'website_listing_maps') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: null }) }),
            }),
          }
        }
        throw new Error(table)
      },
    }

    const result = await ingestWebsiteEnquiry(admin as never, {
      enquiryId: ENQUIRY_ID,
      propertyId: PROPERTY_ID,
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
      guests: 2,
      fullName: 'Ama Mensah',
      email: 'ama@example.com',
      phone: '0244123456',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('UNMAPPED')
  })

  it('reuses an existing reservation for the same enquiry', async () => {
    const { ingestWebsiteEnquiry } = await import('@/lib/website/ingest-enquiry')
    const admin = {
      from: (table: string) => {
        if (table === 'reservations') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 'res-1',
                    hotel_id: 'hotel-1',
                    room_id: 'room-1',
                    status: 'provisional',
                  },
                }),
              }),
            }),
          }
        }
        throw new Error(table)
      },
    }

    const result = await ingestWebsiteEnquiry(admin as never, {
      enquiryId: ENQUIRY_ID,
      propertyId: PROPERTY_ID,
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
      guests: 2,
      fullName: 'Ama Mensah',
      email: 'ama@example.com',
      phone: '0244123456',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.reused).toBe(true)
      expect(result.reservationId).toBe('res-1')
    }
  })
})

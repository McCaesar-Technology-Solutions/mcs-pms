import { describe, expect, it } from 'vitest'
import { invoiceProductLabel } from '@/lib/invoices/product-label'

describe('invoiceProductLabel', () => {
  it('includes category, room, and nights', () => {
    expect(
      invoiceProductLabel({ roomCategoryName: 'Deluxe', roomNumber: '12', nights: 3 }),
    ).toBe('Deluxe · Room 12 (3 nights)')
  })

  it('omits category when missing', () => {
    expect(invoiceProductLabel({ roomNumber: '12', nights: 1 })).toBe('Room 12 (1 night)')
  })

  it('labels a week and a month stay', () => {
    expect(invoiceProductLabel({ roomNumber: '4', nights: 7, roomCategoryName: 'Suite' })).toBe(
      'Suite · Room 4 (One week)',
    )
    expect(invoiceProductLabel({ roomNumber: '4', nights: 30 })).toBe('Room 4 (One month)')
  })
})

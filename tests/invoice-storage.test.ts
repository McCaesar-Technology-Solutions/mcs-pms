import { describe, expect, it } from 'vitest'
import {
  invoiceFileExtension,
  invoiceStoragePath,
  sanitizeDownloadFilename,
} from '@/lib/complaints/invoice-storage'

describe('invoiceStoragePath', () => {
  it('builds a hotel-scoped path per complaint', () => {
    expect(invoiceStoragePath('hotel-1', 'complaint-2', 'pdf')).toBe(
      'hotel-1/complaint-2/invoice.pdf',
    )
  })
})

describe('invoiceFileExtension', () => {
  it('accepts PDF and common image types', () => {
    expect(invoiceFileExtension('application/pdf')).toBe('pdf')
    expect(invoiceFileExtension('image/jpeg')).toBe('jpg')
    expect(invoiceFileExtension('text/plain')).toBeNull()
  })
})

describe('sanitizeDownloadFilename', () => {
  it('strips unsafe characters', () => {
    expect(sanitizeDownloadFilename('my/invoice?.pdf')).toBe('my_invoice_.pdf')
  })
})

import { describe, expect, it } from 'vitest'
import { validateGuestIdDocument } from '@/lib/guest/id-documents'

describe('validateGuestIdDocument', () => {
  it('accepts allowed types within size limit', () => {
    const file = new File(['x'], 'id.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 })
    expect(validateGuestIdDocument(file)).toBeNull()
  })

  it('rejects unsupported mime types', () => {
    const file = new File(['x'], 'id.gif', { type: 'image/gif' })
    Object.defineProperty(file, 'size', { value: 1024 })
    expect(validateGuestIdDocument(file)).toMatch(/JPG, PNG, WebP, or PDF/)
  })

  it('rejects files over 5 MB', () => {
    const file = new File(['x'], 'id.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })
    expect(validateGuestIdDocument(file)).toMatch(/5 MB/)
  })
})

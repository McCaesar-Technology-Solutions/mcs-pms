import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

describe('PWA manifest', () => {
  it('exposes install metadata for browser address-bar install', () => {
    const m = manifest()
    expect(m.name).toBe('MOJO Apartments')
    expect(m.start_url).toBe('/login')
    expect(m.display).toBe('standalone')
    expect(m.scope).toBe('/')
    expect(m.icons?.some((i) => i.sizes === '192x192')).toBe(true)
    expect(m.icons?.some((i) => i.sizes === '512x512')).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { ACCESS_HASH_TO_TAB, accessTabsForRole } from '@/lib/access/access-page-tabs'

describe('accessTabsForRole', () => {
  it('gives reception Today + Guests only', () => {
    expect(accessTabsForRole('receptionist').map((t) => t.id)).toEqual(['today', 'guests'])
  })

  it('gives manager ops tabs without Setup', () => {
    expect(accessTabsForRole('manager').map((t) => t.id)).toEqual([
      'today',
      'guests',
      'staff',
      'attendance',
    ])
  })

  it('gives owner Setup last and mutes when healthy', () => {
    const open = accessTabsForRole('owner', { openJobBadge: 3 })
    expect(open.map((t) => t.id)).toEqual([
      'today',
      'guests',
      'staff',
      'attendance',
      'setup',
    ])
    expect(open[0]?.badge).toBe(3)
    expect(open.find((t) => t.id === 'setup')?.muted).toBeFalsy()

    const healthy = accessTabsForRole('owner', { setupHealthy: true })
    const setup = healthy.find((t) => t.id === 'setup')
    expect(setup?.label).toBe('Setup · OK')
    expect(setup?.muted).toBe(true)
  })

  it('still accepts openJobBadge number shorthand', () => {
    expect(accessTabsForRole('owner', 2)[0]?.badge).toBe(2)
  })

  it('maps unlock/install hashes', () => {
    expect(ACCESS_HASH_TO_TAB.unlock).toBe('today')
    expect(ACCESS_HASH_TO_TAB.install).toBe('setup')
    expect(ACCESS_HASH_TO_TAB.staff).toBe('staff')
  })
})

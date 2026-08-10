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

  it('gives owner Setup last', () => {
    const ids = accessTabsForRole('owner', 3).map((t) => t.id)
    expect(ids).toEqual(['today', 'guests', 'staff', 'attendance', 'setup'])
    expect(accessTabsForRole('owner', 3)[0]?.badge).toBe(3)
  })

  it('maps unlock/install hashes', () => {
    expect(ACCESS_HASH_TO_TAB.unlock).toBe('today')
    expect(ACCESS_HASH_TO_TAB.install).toBe('setup')
    expect(ACCESS_HASH_TO_TAB.staff).toBe('staff')
  })
})

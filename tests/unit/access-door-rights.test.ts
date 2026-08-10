import { describe, expect, it } from 'vitest'
import { doorRightString, groupDoorTargetsByDevice } from '@/lib/access/door-rights'

describe('door rights grouping', () => {
  it('collects multiple door numbers on the same controller', () => {
    const grouped = groupDoorTargetsByDevice([
      { deviceKey: 'acs1', doorNo: 1 },
      { deviceKey: 'acs1', doorNo: 2 },
      { deviceKey: 'lobby', doorNo: 1 },
    ])
    expect(grouped.get('acs1')).toEqual([1, 2])
    expect(grouped.get('lobby')).toEqual([1])
    expect(doorRightString(grouped.get('acs1')!)).toBe('1,2')
  })

  it('defaults missing doorNo to 1', () => {
    const grouped = groupDoorTargetsByDevice([{ deviceKey: 'r9' }])
    expect(grouped.get('r9')).toEqual([1])
  })
})

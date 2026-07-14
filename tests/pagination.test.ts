import { describe, expect, it } from 'vitest'
import {
  pageToOffset,
  parsePageParam,
  totalPagesForCount,
} from '@/lib/data/pagination'

describe('pagination helpers', () => {
  it('parsePageParam defaults invalid values to page 1', () => {
    expect(parsePageParam(undefined)).toBe(1)
    expect(parsePageParam('0')).toBe(1)
    expect(parsePageParam('-2')).toBe(1)
    expect(parsePageParam('abc')).toBe(1)
    expect(parsePageParam('3')).toBe(3)
  })

  it('computes offsets and total pages', () => {
    expect(pageToOffset(1, 10)).toBe(0)
    expect(pageToOffset(3, 10)).toBe(20)
    expect(totalPagesForCount(0, 10)).toBe(1)
    expect(totalPagesForCount(25, 10)).toBe(3)
  })
})

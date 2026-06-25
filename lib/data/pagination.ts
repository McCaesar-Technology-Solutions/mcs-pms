export const DEFAULT_LIST_LIMIT = 100
export const MAX_LIST_LIMIT = 200

export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_LIST_LIMIT
  return Math.min(limit, MAX_LIST_LIMIT)
}

export interface PaginatedResult<T> {
  items: T[]
  hasMore: boolean
  nextOffset: number
}

export function paginateSlice<T>(items: T[], offset = 0, limit = DEFAULT_LIST_LIMIT): PaginatedResult<T> {
  const safeLimit = clampLimit(limit)
  const slice = items.slice(offset, offset + safeLimit)
  return {
    items: slice,
    hasMore: offset + safeLimit < items.length,
    nextOffset: offset + slice.length,
  }
}

export const DEFAULT_LIST_LIMIT = 100
export const MAX_LIST_LIMIT = 200
/** Cap dashboard/history loads so a single property cannot pull unbounded rows. */
export const DASHBOARD_HISTORY_LIMIT = 250

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

export function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function pageToOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * pageSize
}

export function totalPagesForCount(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize))
}

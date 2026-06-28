'use client'

import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_TABLE_PAGE_SIZE = 10

export function usePagination<T>(
  items: T[],
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  resetKey?: string | number,
) {
  const [page, setPage] = useState(1)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  function goToPage(next: number) {
    setPage(Math.max(1, Math.min(totalPages, next)))
  }

  return {
    page: safePage,
    setPage: goToPage,
    totalPages,
    totalItems,
    pageSize,
    paginatedItems,
    hasPagination: totalItems > pageSize,
    rangeStart: totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1,
    rangeEnd: Math.min(safePage * pageSize, totalItems),
  }
}

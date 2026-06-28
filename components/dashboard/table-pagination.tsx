'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TablePaginationProps {
  page: number
  totalPages: number
  totalItems: number
  rangeStart: number
  rangeEnd: number
  onPageChange: (page: number) => void
  className?: string
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  className = '',
}: TablePaginationProps) {
  if (totalItems === 0) return null

  return (
    <div
      className={`table-pagination flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(var(--glow-purple),0.08)] px-4 py-3 sm:px-6 ${className}`}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {totalItems <= 1 ? (
          <span>{totalItems} row</span>
        ) : (
          <span>
            {rangeStart}–{rangeEnd} of {totalItems}
          </span>
        )}
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="table-pagination__btn"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-medium tabular-nums text-foreground">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="table-pagination__btn"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

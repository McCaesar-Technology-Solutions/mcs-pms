'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatOpsDateLabel, isOpsDateToday, parseOpsDate, shiftOpsDate } from '@/lib/dates/ops-date'

interface OpsDateSelectorProps {
  opsDate: string
  className?: string
}

export function OpsDateSelector({ opsDate, className = '' }: OpsDateSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const label = useMemo(() => formatOpsDateLabel(opsDate), [opsDate])
  const isToday = isOpsDateToday(opsDate)

  const setDate = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (isOpsDateToday(next)) {
        params.delete('opsDate')
      } else {
        params.set('opsDate', next)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <div className={`ops-date-selector ${className}`.trim()} role="group" aria-label="Operations date">
      <button
        type="button"
        className="ops-date-selector__nav"
        aria-label="Previous day"
        onClick={() => setDate(shiftOpsDate(opsDate, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <label className="ops-date-selector__field">
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="date"
          value={opsDate}
          onChange={(e) => setDate(parseOpsDate(e.target.value))}
          className="ops-date-selector__input"
          aria-label="Select operations date"
        />
        <span className="ops-date-selector__label">{label}</span>
        {!isToday && (
          <button
            type="button"
            className="ops-date-selector__today"
            onClick={() => setDate(parseOpsDate(null))}
          >
            Today
          </button>
        )}
      </label>

      <button
        type="button"
        className="ops-date-selector__nav"
        aria-label="Next day"
        onClick={() => setDate(shiftOpsDate(opsDate, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { formatOpsDateLabel, isOpsDateToday, parseOpsDate, shiftOpsDate } from '@/lib/dates/ops-date'

interface OpsDateSelectorProps {
  opsDate: string
  className?: string
}

export function OpsDateSelector({ opsDate, className = '' }: OpsDateSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [optimisticDate, setOptimisticDate] = useState<string | null>(null)

  const displayDate = optimisticDate ?? opsDate
  const label = useMemo(() => formatOpsDateLabel(displayDate), [displayDate])
  const isToday = isOpsDateToday(displayDate)
  const loading = pending || optimisticDate !== null

  useEffect(() => {
    setOptimisticDate(null)
  }, [opsDate])

  const setDate = useCallback(
    (next: string) => {
      if (next === displayDate && !loading) return
      setOptimisticDate(next)
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (isOpsDateToday(next)) {
          params.delete('opsDate')
        } else {
          params.set('opsDate', next)
        }
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [displayDate, loading, pathname, router, searchParams],
  )

  return (
    <div
      className={`ops-date-selector${loading ? ' ops-date-selector--loading' : ''} ${className}`.trim()}
      role="group"
      aria-label="Operations date"
      aria-busy={loading}
    >
      <button
        type="button"
        className="ops-date-selector__nav"
        aria-label="Previous day"
        disabled={loading}
        onClick={() => setDate(shiftOpsDate(displayDate, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <label className="ops-date-selector__field">
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--brand-purple-bright)]" aria-hidden />
        ) : (
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          type="date"
          value={displayDate}
          disabled={loading}
          onChange={(e) => setDate(parseOpsDate(e.target.value))}
          className="ops-date-selector__input"
          aria-label="Select operations date"
        />
        <span className="ops-date-selector__label">{label}</span>
        {!isToday && (
          <button
            type="button"
            className="ops-date-selector__today"
            disabled={loading}
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
        disabled={loading}
        onClick={() => setDate(shiftOpsDate(displayDate, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

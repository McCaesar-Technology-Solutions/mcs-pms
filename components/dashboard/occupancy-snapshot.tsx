'use client'

import Link from 'next/link'
import { ChevronRight, Percent } from 'lucide-react'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import type { OccupancyToday } from '@/lib/data/occupancy'

interface OccupancySnapshotProps {
  occupancy?: OccupancyToday
  trend?: number[]
  roomsHref?: string
}

export function OccupancySnapshot({
  occupancy,
  trend = [],
  roomsHref = '/owner/rooms',
}: OccupancySnapshotProps) {
  const hasTrend = trend.length >= 2 && new Set(trend).size > 1

  return (
    <div className="kpi-card kpi-card--occupancy-hero">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kpi-card__label">Occupancy today</p>
            <p className="kpi-card__value kpi-card__value--occupancy mt-2">
              {occupancy ? `${occupancy.percent}%` : '—'}
            </p>
            {occupancy && (
              <p className="kpi-card__subtext mt-2">
                {occupancy.occupied} of {occupancy.total} rooms in use
              </p>
            )}
          </div>
          <div className="occupancy-hero__icon" aria-hidden>
            <Percent className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>

        {occupancy && (
          <div className="occupancy-hero__track mt-4">
            <div
              className="occupancy-hero__fill"
              style={{ width: `${Math.min(100, Math.max(0, occupancy.percent))}%` }}
            />
          </div>
        )}

        {hasTrend && (
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-[11px] font-medium text-muted-foreground">14-day trend</p>
            <MiniSparkline values={trend} tone="primary" className="h-9 w-[6.5rem]" />
          </div>
        )}

        <Link
          href={roomsHref}
          className="occupancy-hero__link mt-auto pt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
        >
          Room board
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

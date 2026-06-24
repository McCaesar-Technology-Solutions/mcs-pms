'use client'

import { useState } from 'react'
import { CalendarRange, ChevronDown, ChevronUp } from 'lucide-react'
import { ReservationsGantt } from '@/components/dashboard/reservations-gantt'
import type { OccupancyTimelineBar } from '@/lib/data/occupancy-timeline'

interface ReservationsTimelineSectionProps {
  rooms: { id: string; number: string }[]
  bars: OccupancyTimelineBar[]
}

export function ReservationsTimelineSection({ rooms, bars }: ReservationsTimelineSectionProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="surface-card flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarRange className="h-4 w-4 text-[#3C216C]" />
            {mobileOpen ? 'Hide timeline' : 'View room timeline'}
          </span>
          {mobileOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {mobileOpen && (
          <div className="mt-3">
            <ReservationsGantt rooms={rooms} bars={bars} />
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <ReservationsGantt rooms={rooms} bars={bars} />
      </div>
    </>
  )
}

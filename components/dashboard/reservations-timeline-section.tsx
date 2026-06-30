'use client'

import { useState } from 'react'
import { CalendarRange, ChevronDown } from 'lucide-react'
import { ReservationsGantt } from '@/components/dashboard/reservations-gantt'
import type { OccupancyTimelineBar } from '@/lib/data/occupancy-timeline'
import type { RoomRef } from '@/lib/data/occupancy'

interface ReservationsTimelineSectionProps {
  rooms: RoomRef[]
  bars: OccupancyTimelineBar[]
}

export function ReservationsTimelineSection({ rooms, bars }: ReservationsTimelineSectionProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="md:hidden">
        <section className="floor-board__section">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            className="floor-board__header"
          >
            <div className="floor-board__header-main">
              <span className="floor-board__floor-num">
                <CalendarRange className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 text-left">
                <p className="floor-board__title">Occupancy timeline</p>
                <p className="floor-board__meta">
                  {rooms.length} room{rooms.length === 1 ? '' : 's'} · next 21 days
                </p>
              </div>
            </div>
            <ChevronDown
              className={`floor-board__chevron h-5 w-5 shrink-0 ${mobileOpen ? 'floor-board__chevron--open' : ''}`}
              aria-hidden
            />
          </button>
          {mobileOpen && (
            <div className="occupancy-timeline__floor-body p-2">
              <ReservationsGantt rooms={rooms} bars={bars} compact />
            </div>
          )}
        </section>
      </div>

      <div className="hidden md:block">
        <ReservationsGantt rooms={rooms} bars={bars} />
      </div>
    </>
  )
}

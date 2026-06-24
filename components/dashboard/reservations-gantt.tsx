'use client'

import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { useProperty } from '@/lib/property-context'
import {
  barForRoomOnDate,
  isFirstVisibleStayDate,
  type OccupancyTimelineBar,
  type TimelineBarSource,
} from '@/lib/data/occupancy-timeline'
import { timelineSourceStyle, TIMELINE_SOURCE_STYLES } from '@/lib/occupancy/timeline-styles'

const DAY_COL_WIDTH = 2.75

interface OccupancyTimelineProps {
  rooms: { id: string; number: string }[]
  bars: OccupancyTimelineBar[]
}

function parseDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00')
}

function isWeekend(dateStr: string) {
  const day = parseDate(dateStr).getDay()
  return day === 0 || day === 6
}

export function ReservationsGantt({ rooms, bars }: OccupancyTimelineProps) {
  const { activeProperty } = useProperty()
  const todayStr = new Date().toISOString().split('T')[0]
  const days = 21

  const dateRange = useMemo(
    () =>
      Array.from({ length: days }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() + i)
        return date.toISOString().split('T')[0]
      }),
    [days],
  )

  const rangeStart = dateRange[0]!
  const activeSources = useMemo(() => {
    const set = new Set<TimelineBarSource>()
    for (const bar of bars) {
      if (bar.checkOut <= rangeStart || bar.checkIn > dateRange[dateRange.length - 1]!) continue
      set.add(bar.source)
    }
    return set
  }, [bars, dateRange, rangeStart])

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    [rooms],
  )

  if (sortedRooms.length === 0) {
    return (
      <DataEmptyState
        title="Occupancy timeline"
        message="Add rooms to your property to see the timeline."
      />
    )
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />

      <div className="surface-card-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-elevation-1">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Occupancy Timeline</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeProperty.name} · {sortedRooms.length} rooms · reservations &amp; in-house
                stays · next {days} days
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {[...activeSources].map((source) => {
              const style = TIMELINE_SOURCE_STYLES[source]
              return (
                <div key={source} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-sm ${style.legend}`} />
                  <span className="text-xs text-muted-foreground">{style.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-[var(--card)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6 bg-gradient-to-l from-[var(--card)] to-transparent" />

        <div className="overflow-x-auto px-2 pb-4 pt-2">
          <div className="min-w-max">
            <div
              className="grid items-end gap-0"
              style={{ gridTemplateColumns: `5.5rem repeat(${days}, ${DAY_COL_WIDTH}rem)` }}
            >
              <div className="sticky left-0 z-10 bg-[var(--card)] px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Room
              </div>
              {dateRange.map((date) => {
                const d = parseDate(date)
                const isToday = date === todayStr
                const weekend = isWeekend(date)
                return (
                  <div
                    key={date}
                    className={`px-0.5 pb-2 text-center ${
                      isToday
                        ? 'rounded-t-lg bg-[#3C216C]/8 ring-1 ring-[#3C216C]/20'
                        : weekend
                          ? 'bg-[#FAFDFF]/80'
                          : ''
                    }`}
                  >
                    <p
                      className={`text-[10px] font-bold uppercase ${isToday ? 'text-[#3C216C]' : 'text-muted-foreground'}`}
                    >
                      {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-semibold ${isToday ? 'text-[#3C216C]' : 'text-foreground'}`}
                    >
                      {d.getDate()}
                    </p>
                    {isToday && (
                      <span className="mt-1 inline-block rounded bg-[#D4A62E] px-1 py-px text-[8px] font-bold text-[#22124C]">
                        TODAY
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {sortedRooms.map((room) => (
              <div
                key={room.id}
                className="grid border-t border-[#E9ECEF]"
                style={{ gridTemplateColumns: `5.5rem repeat(${days}, ${DAY_COL_WIDTH}rem)` }}
              >
                <div className="sticky left-0 z-10 flex items-center border-r border-[#E9ECEF] bg-[var(--card)] px-2 py-2 text-sm font-semibold text-foreground shadow-[4px_0_12px_-4px_rgba(34,18,76,0.08)]">
                  {room.number}
                </div>

                {dateRange.map((date) => {
                  const bar = barForRoomOnDate(bars, room.id, date)
                  const isToday = date === todayStr
                  const weekend = isWeekend(date)
                  const style = bar ? timelineSourceStyle(bar.source) : null
                  const showLabel = bar ? isFirstVisibleStayDate(bar, date, rangeStart) : false

                  return (
                    <div
                      key={date}
                      className={`flex h-12 items-center justify-center border-r border-[#E9ECEF]/80 p-0.5 ${
                        isToday ? 'bg-[#3C216C]/5' : weekend ? 'bg-[#FAFDFF]/50' : ''
                      }`}
                    >
                      {bar && style ? (
                        <div
                          className={`flex h-9 w-full items-center justify-center overflow-hidden rounded-md px-1 text-[9px] font-semibold shadow-sm ${style.cell}`}
                          title={`${bar.guestName} · ${bar.checkIn} → ${bar.checkOut}`}
                        >
                          <span className="truncate">{showLabel ? bar.guestName.split(' ')[0] : ''}</span>
                        </div>
                      ) : (
                        <div className="h-9 w-full rounded-md border border-dashed border-[#E9ECEF]/80 bg-transparent" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

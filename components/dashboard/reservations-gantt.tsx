'use client'

import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'
import { reservations as mockReservations } from '@/lib/mock-data'
import { useProperty } from '@/lib/property-context'
import type { Reservation } from '@/types'

const SOURCE_STYLES: Record<string, { bar: string; legend: string; label: string }> = {
  website: { bar: 'bg-[#3C216C] text-white', legend: 'bg-[#3C216C]', label: 'Website' },
  airbnb: { bar: 'bg-sky-600 text-white', legend: 'bg-sky-600', label: 'Airbnb' },
  booking: { bar: 'bg-[#2D215B] text-white', legend: 'bg-[#2D215B]', label: 'Booking.com' },
  walk_in: { bar: 'bg-[#D4A62E] text-[#22124C]', legend: 'bg-[#D4A62E]', label: 'Walk-in' },
  other: { bar: 'bg-gray-500 text-white', legend: 'bg-gray-500', label: 'Other' },
}

const DAY_COL_WIDTH = 2.75

function parseDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00')
}

function isWeekend(dateStr: string) {
  const day = parseDate(dateStr).getDay()
  return day === 0 || day === 6
}

export function ReservationsGantt({ data }: { data?: Reservation[] }) {
  const { activePropertyId, activeProperty } = useProperty()
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

  const propertyReservations = useMemo(
    () =>
      data
        ? data.filter((r) => r.status !== 'cancelled')
        : mockReservations.filter((r) => r.propertyId === activePropertyId),
    [data, activePropertyId],
  )

  const roomNumbers = useMemo(() => {
    const fromData = [...new Set(propertyReservations.map((r) => r.roomNumber))]
    return fromData.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [propertyReservations])

  const getBarSpan = (checkIn: string, checkOut: string) => {
    const rangeStart = dateRange[0]
    const rangeEnd = dateRange[dateRange.length - 1]
    if (checkOut <= rangeStart || checkIn > rangeEnd) return null

    const startIdx = Math.max(0, dateRange.indexOf(checkIn))
    const effectiveStart = checkIn < rangeStart ? 0 : startIdx >= 0 ? startIdx : 0

    let endIdx = dateRange.findIndex((d) => d >= checkOut)
    if (endIdx === -1) endIdx = days
    else if (checkOut > rangeEnd) endIdx = days

    const span = Math.max(1, endIdx - effectiveStart)
    return { startIdx: effectiveStart, span }
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
                {activeProperty.name} · {roomNumbers.length} rooms with bookings · next {days} days
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {Object.entries(SOURCE_STYLES).map(([key, style]) =>
              propertyReservations.some((r) => r.source === key) ? (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`h-2.5 w-2.5 rounded-sm ${style.legend}`} />
                  <span className="text-xs text-muted-foreground">{style.label}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {roomNumbers.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">
          No upcoming reservations to display on the timeline.
        </p>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-[var(--card)] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6 bg-gradient-to-l from-[var(--card)] to-transparent" />

          <div className="overflow-x-auto px-2 pb-4 pt-2">
            <div className="min-w-max">
              {/* Header row */}
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
                        isToday ? 'rounded-t-lg bg-[#3C216C]/8 ring-1 ring-[#3C216C]/20' : weekend ? 'bg-[#FAFDFF]/80' : ''
                      }`}
                    >
                      <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-[#3C216C]' : 'text-muted-foreground'}`}>
                        {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </p>
                      <p className={`mt-0.5 text-xs font-semibold ${isToday ? 'text-[#3C216C]' : 'text-foreground'}`}>
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

              {/* Room rows */}
              {roomNumbers.map((room) => {
                const roomReservations = propertyReservations.filter((r) => r.roomNumber === room)
                return (
                  <div
                    key={room}
                    className="relative grid border-t border-[#E9ECEF]"
                    style={{ gridTemplateColumns: `5.5rem repeat(${days}, ${DAY_COL_WIDTH}rem)` }}
                  >
                    <div className="sticky left-0 z-10 flex items-center border-r border-[#E9ECEF] bg-[var(--card)] px-2 py-3 text-sm font-semibold text-foreground shadow-[4px_0_12px_-4px_rgba(34,18,76,0.08)]">
                      {room}
                    </div>
                    {dateRange.map((date) => (
                      <div
                        key={date}
                        className={`h-12 border-r border-[#E9ECEF]/80 ${
                          date === todayStr ? 'bg-[#3C216C]/5' : isWeekend(date) ? 'bg-[#FAFDFF]/50' : ''
                        }`}
                      />
                    ))}

                    {roomReservations.map((res) => {
                      const placement = getBarSpan(res.checkInDate, res.checkOutDate)
                      if (!placement) return null
                      const style = SOURCE_STYLES[res.source] ?? SOURCE_STYLES.other
                      const leftRem = 5.5 + placement.startIdx * DAY_COL_WIDTH
                      const widthRem = placement.span * DAY_COL_WIDTH - 0.25

                      return (
                        <div
                          key={res.id}
                          className={`absolute top-2 z-[1] flex h-8 items-center overflow-hidden rounded-md px-2 text-[10px] font-semibold shadow-elevation-1 transition-opacity hover:opacity-90 ${style.bar}`}
                          style={{
                            left: `${leftRem}rem`,
                            width: `${widthRem}rem`,
                          }}
                          title={`${res.guestName} · ${res.checkInDate} → ${res.checkOutDate}`}
                        >
                          <span className="truncate">
                            {placement.span >= 2 ? res.guestName.split(' ')[0] : '→'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

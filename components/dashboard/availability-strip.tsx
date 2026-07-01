'use client'

import { useState } from 'react'
import { BedDouble, CalendarDays, Wrench } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { useProperty } from '@/lib/property-context'
import type { Availability } from '@/types'

const SEGMENTS = [
  { key: 'occupied' as const, label: 'Occupied', color: 'bg-primary', text: 'text-primary' },
  { key: 'reserved' as const, label: 'Reserved', color: 'bg-[var(--comp-sky)]', text: 'text-[var(--comp-sky-ink)]' },
  { key: 'maintenance' as const, label: 'Maintenance', color: 'bg-[var(--comp-coral)]', text: 'text-[var(--comp-coral-ink)]' },
  { key: 'available' as const, label: 'Available', color: 'bg-[var(--comp-sage)]', text: 'text-[var(--comp-sage-ink)]' },
]

function getTotal(day: Availability) {
  return day.occupied + day.reserved + day.maintenance + day.available
}

function getBooked(day: Availability) {
  return day.occupied + day.reserved
}

function getOccupancyPercent(day: Availability) {
  const total = getTotal(day)
  return total > 0 ? Math.round((getBooked(day) / total) * 100) : 0
}

function getAvailabilityTone(available: number, totalRooms: number) {
  const ratio = totalRooms > 0 ? available / totalRooms : 0
  if (ratio >= 0.33) return { label: 'Good availability', className: 'text-[var(--comp-sage-ink)] bg-[var(--comp-sage-soft)]' }
  if (ratio >= 0.18) return { label: 'Limited availability', className: 'text-[var(--comp-sand-ink)] bg-[var(--comp-sand-soft)]' }
  return { label: 'Nearly full', className: 'text-[var(--comp-coral-ink)] bg-[var(--comp-coral-soft)]' }
}

function formatDayLabel(dateStr: string, isToday: boolean) {
  const date = new Date(dateStr + 'T12:00:00')
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isToday,
  }
}

function OccupancyHeatmap({
  availability,
  totalRooms,
  todayStr,
  selectedDate,
  onSelect,
}: {
  availability: Availability[]
  totalRooms: number
  todayStr: string
  selectedDate: string
  onSelect: (date: string) => void
}) {
  return (
    <div className="py-1">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Occupancy calendar</p>
          <p className="text-xs text-muted-foreground">Tap a day — bar height shows how full you are</p>
        </div>
        <p className="text-xs text-muted-foreground">{totalRooms} rooms · 14 days</p>
      </div>
      <div className="flex items-end gap-1.5 sm:gap-2">
        {availability.map((day) => {
          const { weekday, isToday } = formatDayLabel(day.date, day.date === todayStr)
          const bookedPct = getOccupancyPercent(day)
          const isSelected = day.date === selectedDate

          return (
            <button
              key={day.date}
              type="button"
              title={`${day.date}: ${bookedPct}% booked, ${day.available} free`}
              onClick={() => onSelect(day.date)}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-lg px-0.5 py-1 transition ${
                isSelected ? 'bg-primary/8 ring-1 ring-primary/25' : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex h-14 w-full items-end justify-center">
                <div className="flex h-full w-full max-w-[2rem] flex-col justify-end">
                  <div
                    className={`w-full overflow-hidden rounded-md border border-border/50 bg-[var(--comp-sage-soft)] transition-transform group-hover:scale-105 ${
                      isToday ? 'ring-1 ring-primary/30' : ''
                    }`}
                    style={{ height: `${bookedPct}%`, minHeight: bookedPct > 0 ? 6 : 2 }}
                  >
                    <div className="flex h-full w-full flex-col justify-end">
                      {day.occupied > 0 && (
                        <div
                          className="w-full bg-primary"
                          style={{ flex: day.occupied }}
                        />
                      )}
                      {day.reserved > 0 && (
                        <div
                          className="w-full bg-[var(--comp-sky)]"
                          style={{ flex: day.reserved }}
                        />
                      )}
                      {day.maintenance > 0 && (
                        <div
                          className="w-full bg-[var(--comp-coral)]"
                          style={{ flex: day.maintenance }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <span
                className={`text-[9px] font-semibold leading-none ${
                  isToday ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isToday ? 'Today' : weekday.slice(0, 2)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AvailabilityStrip({ data }: { data?: Availability[] }) {
  const { activeProperty } = useProperty()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  if (!data || data.length === 0) {
    return (
      <DataEmptyState
        title="Room availability"
        message="Add rooms and reservations to see the 14-day forecast."
      />
    )
  }

  const availability = data
  const totalRooms = availability[0] ? getTotal(availability[0]) : activeProperty.totalRooms
  const todayStr = availability[0]?.date ?? ''
  const today = availability[0]
  const activeDate = selectedDate ?? todayStr
  const selected = availability.find((d) => d.date === activeDate) ?? today

  return (
    <div className="surface-card">
      <div className="surface-card-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Room availability</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeProperty.name} · {totalRooms} rooms · 14-day forecast
            </p>
          </div>
          {today && (
            <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityTone(today.available, totalRooms).className}`}>
              <BedDouble className="h-3.5 w-3.5" />
              Today: {today.available} rooms open
            </span>
          )}
        </div>
      </div>

      <div className="surface-card-body">
      <div className="surface-card-section--muted">
      <OccupancyHeatmap
        availability={availability}
        totalRooms={totalRooms}
        todayStr={todayStr}
        selectedDate={activeDate}
        onSelect={setSelectedDate}
      />
      </div>

      {today && (
        <div className="grid grid-cols-2 gap-3 px-3 sm:grid-cols-4">
          {SEGMENTS.map(({ key, label, color, text }) => (
            <div key={key} className="surface-inset rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
              </div>
              <p className={`mt-1 text-2xl font-bold ${text}`}>{today[key]}</p>
              <p className="text-[11px] text-muted-foreground">rooms today</p>
            </div>
          ))}
        </div>
      )}

      <div className="surface-card-section availability-day-strip">
        <div className="availability-day-strip__hint">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Each bar shows all {totalRooms} rooms.{' '}
            <span className="font-semibold text-foreground">Tap a day</span> to see the breakdown.{' '}
            <span className="inline-flex items-center gap-1 font-medium text-[var(--comp-sage-ink)]">
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--comp-sage)]" />
              Green = rooms you can still sell
            </span>
          </p>
        </div>

        <div className="overflow-x-auto -mx-1 px-1 pb-2 pt-1">
          <div className="flex min-w-max gap-4">
            {availability.map((day) => {
              const { weekday, date, isToday } = formatDayLabel(day.date, day.date === todayStr)
              const isSelected = day.date === activeDate
              const occupancy = getOccupancyPercent(day)

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={[
                    'availability-day-card flex w-[6.5rem] shrink-0 flex-col justify-between px-4 py-5 text-left',
                    isToday ? 'availability-day-card--today' : '',
                    isSelected ? 'availability-day-card--selected' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="mb-3 flex items-center justify-between gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                      {isToday ? 'Today' : weekday}
                    </span>
                    {isToday && (
                      <span className="rounded-md bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-elevation-1">NOW</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{date}</p>

                  <div
                    className="mt-4 flex h-4 w-full overflow-hidden rounded-md border border-border bg-[var(--comp-sage-soft)]"
                    title={`${day.available} available, ${day.occupied} occupied, ${day.reserved} reserved, ${day.maintenance} maintenance`}
                  >
                    <div className="bg-primary" style={{ width: `${(day.occupied / totalRooms) * 100}%` }} />
                    <div className="bg-[var(--comp-sky)]" style={{ width: `${(day.reserved / totalRooms) * 100}%` }} />
                    <div className="bg-[var(--comp-coral)]" style={{ width: `${(day.maintenance / totalRooms) * 100}%` }} />
                    <div className="min-w-0 flex-1 bg-[var(--comp-sage)]" />
                  </div>

                  <div className="mt-4">
                    <p className="text-xl font-bold leading-none text-foreground">{day.available}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">rooms free</p>
                    <p className="mt-2 text-[10px] font-semibold text-primary/80">{occupancy}% booked</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Selected day detail panel */}
      {selected && (
        <div className="surface-card-section--muted mx-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="gradient-primary flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-elevation-1">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {selected.date === todayStr ? 'Today' : new Date(selected.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getBooked(selected)} of {totalRooms} rooms booked ({getOccupancyPercent(selected)}% occupancy)
                </p>
              </div>
            </div>
            <span className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityTone(selected.available, totalRooms).className}`}>
              {getAvailabilityTone(selected.available, totalRooms).label}
            </span>
          </div>

          {/* Full-width breakdown bar with labels */}
          <div className="mt-4">
            <div className="flex h-8 w-full overflow-hidden rounded-lg shadow-elevation-1">
              {SEGMENTS.filter((s) => s.key !== 'available').map(({ key, color }) =>
                selected[key] > 0 ? (
                  <div
                    key={key}
                    className={`${color} flex items-center justify-center text-[10px] font-bold text-white`}
                    style={{ width: `${(selected[key] / totalRooms) * 100}%` }}
                  >
                    {selected[key] >= 3 ? selected[key] : ''}
                  </div>
                ) : null
              )}
              {selected.available > 0 && (
                <div
                  className="flex flex-1 items-center justify-center bg-amber-400/80 text-[10px] font-bold text-amber-900"
                  style={{ minWidth: `${(selected.available / totalRooms) * 100}%` }}
                >
                  {selected.available}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SEGMENTS.map(({ key, label, color, text }) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                  <span className="text-xs text-muted-foreground">
                    {label}: <span className={`font-semibold ${text}`}>{selected[key]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {selected.maintenance > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
              <Wrench className="h-3.5 w-3.5 shrink-0" />
              {selected.maintenance} room{selected.maintenance > 1 ? 's' : ''} out of service — not available for booking
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="surface-card-section flex flex-wrap items-center gap-x-5 gap-y-2">
        {SEGMENTS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

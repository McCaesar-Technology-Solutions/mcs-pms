'use client'

import { useMemo, useState } from 'react'
import { BedDouble, CalendarDays, Wrench } from 'lucide-react'
import { generateAvailability } from '@/lib/mock-data'
import { useProperty } from '@/lib/property-context'
import type { Availability } from '@/types'

const SEGMENTS = [
  { key: 'occupied' as const, label: 'Occupied', color: 'bg-primary', text: 'text-primary' },
  { key: 'reserved' as const, label: 'Reserved', color: 'bg-sky-500', text: 'text-sky-600' },
  { key: 'maintenance' as const, label: 'Maintenance', color: 'bg-amber-500', text: 'text-amber-600' },
  { key: 'available' as const, label: 'Available', color: 'bg-[#D4A62E]/80', text: 'text-[#B88D24]' },
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
  if (ratio >= 0.33) return { label: 'Good availability', className: 'text-amber-700 bg-amber-500/10' }
  if (ratio >= 0.18) return { label: 'Limited availability', className: 'text-amber-700 bg-amber-500/10' }
  return { label: 'Nearly full', className: 'text-red-700 bg-red-500/10' }
}

function formatDayLabel(dateStr: string, isToday: boolean) {
  const date = new Date(dateStr + 'T12:00:00')
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    isToday,
  }
}

export function AvailabilityStrip({ data }: { data?: Availability[] }) {
  const { activeProperty } = useProperty()
  const fallbackTotal = activeProperty.totalRooms
  const availability = useMemo(
    () => (data && data.length > 0 ? data : generateAvailability(fallbackTotal).slice(0, 14)),
    [data, fallbackTotal],
  )
  const totalRooms = availability[0] ? getTotal(availability[0]) : fallbackTotal
  const todayStr = availability[0]?.date ?? ''
  const today = availability[0]
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const selected = availability.find((d) => d.date === selectedDate) ?? today

  return (
    <div className="surface-card">
      <div className="surface-card-accent" />

      <div className="surface-card-header">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Room Availability</h3>
            <p className="text-sm text-muted-foreground mt-1">
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

      {/* Today at a glance */}
      {today && (
        <div className="grid grid-cols-2 gap-3 border-b border-[#E9ECEF] px-6 py-4 sm:grid-cols-4">
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

      {/* 14-day calendar strip */}
      <div className="availability-day-strip mb-4">
        <div className="availability-day-strip__hint">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Each bar shows all {totalRooms} rooms.{' '}
            <span className="font-semibold text-foreground">Tap a day</span> to see the breakdown.{' '}
            <span className="inline-flex items-center gap-1 font-medium text-[#B88D24]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#D4A62E]" />
              Gold = rooms you can still sell
            </span>
          </p>
        </div>

        <div className="overflow-x-auto -mx-1 px-1 pb-2 pt-1">
          <div className="flex min-w-max gap-4">
            {availability.map((day) => {
              const { weekday, date, isToday } = formatDayLabel(day.date, day.date === todayStr)
              const isSelected = day.date === selectedDate
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
                    className="mt-4 flex h-4 w-full overflow-hidden rounded-md border border-[#E9ECEF] bg-amber-50/50"
                    title={`${day.available} available, ${day.occupied} occupied, ${day.reserved} reserved, ${day.maintenance} maintenance`}
                  >
                    <div className="bg-primary" style={{ width: `${(day.occupied / totalRooms) * 100}%` }} />
                    <div className="bg-sky-500" style={{ width: `${(day.reserved / totalRooms) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(day.maintenance / totalRooms) * 100}%` }} />
                    <div className="min-w-0 flex-1 bg-amber-400" />
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
        <div className="mx-6 mb-6 surface-inset rounded-xl p-4">
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-6">
        {SEGMENTS.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

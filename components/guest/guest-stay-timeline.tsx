'use client'

import { useMemo } from 'react'
import { stayCoversDate, stayDates, nightsBetween } from '@/lib/data/occupancy-timeline'

interface GuestStayTimelineProps {
  checkIn: string
  checkOut: string
  roomNumber: string | null
  checkOutTime?: string
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function GuestStayTimeline({
  checkIn,
  checkOut,
  roomNumber,
  checkOutTime = '11:00 AM',
}: GuestStayTimelineProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const nights = nightsBetween(checkIn, checkOut)
  const dates = useMemo(() => stayDates(checkIn, checkOut), [checkIn, checkOut])

  const portalActive = stayCoversDate(checkIn, checkOut, todayStr)
  const checkoutLabel = formatShortDate(checkOut)

  if (dates.length === 0) {
    return null
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#D4A62E]">Your stay</p>
          <p className="mt-1 text-xs text-white/70">
            {formatShortDate(checkIn)} → {checkoutLabel}
            {roomNumber ? ` · Room ${roomNumber}` : ''} · {nights} night{nights === 1 ? '' : 's'}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            portalActive
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'bg-white/10 text-white/50'
          }`}
        >
          {portalActive ? 'Portal active' : 'Stay ended'}
        </span>
      </div>

      <p className="mt-2 text-xs text-white/60">
        Each box is one night of your stay. Portal access matches this period through checkout.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {dates.map((date) => {
          const isToday = date === todayStr
          const isPast = date < todayStr
          const isFuture = date > todayStr

          return (
            <div
              key={date}
              className="flex flex-col items-center gap-1"
              title={formatShortDate(date)}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-[10px] font-bold shadow-sm ${
                  isToday
                    ? 'bg-[#D4A62E] text-[#22124C] ring-2 ring-white/40'
                    : isPast
                      ? 'bg-[#3C216C]/50 text-white/70'
                      : isFuture
                        ? 'bg-[#3C216C] text-white'
                        : 'bg-[#3C216C] text-white'
                }`}
              >
                {new Date(date + 'T12:00:00').getDate()}
              </div>
              <span className="text-[9px] font-medium uppercase text-white/45">
                {isToday ? 'Today' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
            </div>
          )
        })}
      </div>

      {portalActive && (
        <p className="mt-3 text-center text-xs text-white/55">
          Check-out {checkoutLabel} — please vacate by {checkOutTime} unless late checkout was approved.
        </p>
      )}
    </section>
  )
}

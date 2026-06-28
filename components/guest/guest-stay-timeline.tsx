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
  const showNightGrid = nights > 2

  if (dates.length === 0) {
    return null
  }

  return (
    <section className="guest-portal-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="guest-portal-card__title">Your stay</p>
          <p className="guest-portal-card__hint">
            {formatShortDate(checkIn)} → {checkoutLabel}
            {roomNumber ? ` · Room ${roomNumber}` : ''} · {nights} night{nights === 1 ? '' : 's'}
          </p>
        </div>
        {portalActive && (
          <span className="guest-status-pill guest-status-pill--active">
            Active
          </span>
        )}
      </div>

      {showNightGrid && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {dates.map((date) => {
            const isToday = date === todayStr
            const isPast = date < todayStr

            return (
              <div
                key={date}
                className="flex flex-col items-center gap-1"
                title={formatShortDate(date)}
              >
                <div
                  className={`guest-night-pill ${
                    isToday
                      ? 'guest-night-pill--today'
                      : isPast
                        ? 'guest-night-pill--past'
                        : 'guest-night-pill--future'
                  }`}
                >
                  {new Date(date + 'T12:00:00').getDate()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {portalActive && (
        <p className="mt-3 text-xs leading-relaxed guest-text-subtle">
          Please vacate by {checkOutTime} on {checkoutLabel} unless late checkout was approved.
        </p>
      )}
    </section>
  )
}

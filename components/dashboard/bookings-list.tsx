'use client'

import Link from 'next/link'
import { getUpcomingBookings } from '@/lib/data/overview'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import { ChevronRight } from 'lucide-react'
import type { Reservation } from '@/types'

interface BookingsListProps {
  reservations: Reservation[]
  viewAllHref?: string
  compact?: boolean
}

function statusPillClass(status: string) {
  if (status === 'checked_in') return 'status-pill status-pill--warm'
  return 'status-pill status-pill--info'
}

function statusLabel(status: string) {
  if (status === 'checked_in') return 'In house'
  return 'Confirmed'
}

export function BookingsList({
  reservations,
  viewAllHref = '/owner/reservations',
  compact = false,
}: BookingsListProps) {
  const upcomingBookings = getUpcomingBookings(reservations)

  return (
    <div
      className={`surface-card surface-card--interactive overflow-hidden ${
        compact ? 'h-full min-h-[22rem]' : ''
      }`}
    >
      <div className="surface-card-header">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Upcoming bookings</h3>
            <p className="mt-1 text-sm text-muted-foreground">Next reservations</p>
          </div>
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className={`surface-card-body ${compact ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
        {upcomingBookings.length === 0 ? (
          <DataEmptyState borderless message="No upcoming bookings." />
        ) : (
          <div className={`card-list-tray space-y-2.5 ${compact ? 'flex-1 overflow-y-auto' : ''}`}>
            {upcomingBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`${viewAllHref}?open=${booking.id}`}
                className="elevated-list-item block p-3.5 transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{booking.guestName}</p>
                      {booking.guestDoNotDisturb && <GuestDndBadge compact />}
                      <span className={statusPillClass(booking.status)}>
                        {statusLabel(booking.status)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Room {booking.roomNumber} ·{' '}
                      {new Date(booking.checkInDate).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      →{' '}
                      {new Date(booking.checkOutDate).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-foreground">
                      ₵{booking.totalPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{booking.numberOfNights} nights</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { getUpcomingBookings } from '@/lib/data/overview'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { ChevronRight } from 'lucide-react'
import type { Reservation } from '@/types'

interface BookingsListProps {
  reservations: Reservation[]
  viewAllHref?: string
}

export function BookingsList({ reservations, viewAllHref = '/owner/reservations' }: BookingsListProps) {
  const upcomingBookings = getUpcomingBookings(reservations)

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-primary/12 text-primary'
      case 'confirmed':
        return 'bg-[var(--brand-purple-soft)] text-primary'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <div className="surface-card surface-card--interactive overflow-hidden">
      <div className="surface-card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Upcoming bookings</h3>
            <p className="mt-1 text-sm text-muted-foreground">Next 5 reservations</p>
          </div>
          <Link
            href={viewAllHref}
            className="text-primary hover:text-primary/80 text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            View All <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="p-4">
        {upcomingBookings.length === 0 ? (
          <DataEmptyState
            borderless
            message="No upcoming bookings."
          />
        ) : (
          <div className="card-list-tray space-y-3">
            {upcomingBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`${viewAllHref}?open=${booking.id}`}
                className="elevated-list-item block p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{booking.guestName}</p>
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusBadgeColor(booking.status)}`}>
                        {booking.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Room {booking.roomNumber} • {new Date(booking.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                      {new Date(booking.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-foreground">₵{booking.totalPrice.toLocaleString()}</p>
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

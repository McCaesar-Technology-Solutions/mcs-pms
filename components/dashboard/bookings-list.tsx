'use client'

import Link from 'next/link'
import { getUpcomingBookings } from '@/lib/data/overview'
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
        return 'bg-amber-100 text-amber-700'
      case 'confirmed':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Upcoming Bookings</h3>
            <p className="text-sm text-muted-foreground mt-1">Next 5 reservations</p>
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
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">No upcoming bookings.</p>
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
                      <p className="font-semibold text-[#111827]">{booking.guestName}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeColor(booking.status)}`}>
                        {booking.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Room {booking.roomNumber} • {new Date(booking.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                      {new Date(booking.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-[#111827]">₵{booking.totalPrice.toLocaleString()}</p>
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

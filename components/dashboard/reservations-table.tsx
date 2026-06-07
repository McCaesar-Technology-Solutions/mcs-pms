'use client'

import { reservations } from '@/lib/mock-data'
import { useProperty } from '@/lib/property-context'
import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

export function ReservationsTable() {
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null)
  const { activePropertyId } = useProperty()
  const propertyReservations = useMemo(
    () => reservations.filter((r) => r.propertyId === activePropertyId),
    [activePropertyId],
  )

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-emerald-600 text-emerald-50'
      case 'confirmed':
        return 'bg-teal-600 text-teal-50'
      case 'pending':
        return 'bg-amber-600 text-amber-50'
      case 'checked_out':
        return 'bg-gray-600 text-gray-50'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      website: 'bg-teal-50 text-teal-700',
      airbnb: 'bg-blue-50 text-blue-700',
      booking: 'bg-purple-50 text-purple-700',
      walk_in: 'bg-orange-50 text-orange-700',
      other: 'bg-gray-50 text-gray-700',
    }
    return colors[source] || colors.other
  }

  return (
    <>
      <div className="surface-card overflow-hidden">
        <table className="data-table w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-4 px-4 font-semibold text-foreground">Guest</th>
              <th className="text-left py-4 px-4 font-semibold text-foreground">Room</th>
              <th className="text-left py-4 px-4 font-semibold text-foreground">Dates</th>
              <th className="text-left py-4 px-4 font-semibold text-foreground">Status</th>
              <th className="text-left py-4 px-4 font-semibold text-foreground">Source</th>
              <th className="text-right py-4 px-4 font-semibold text-foreground">Amount</th>
              <th className="text-center py-4 px-4 font-semibold text-foreground w-10"></th>
            </tr>
          </thead>
          <tbody>
            {propertyReservations.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 px-4 text-center text-muted-foreground">
                  No reservations for this property yet.
                </td>
              </tr>
            ) : (
              propertyReservations.map((res) => (
              <tr
                key={res.id}
                className="cursor-pointer"
                onClick={() => setSelectedReservation(res.id)}
              >
                <td className="py-4 px-4">
                  <div>
                    <p className="font-semibold text-foreground">{res.guestName}</p>
                    <p className="text-xs text-muted-foreground">{res.guestEmail}</p>
                  </div>
                </td>
                <td className="py-4 px-4 text-foreground font-medium">{res.roomNumber}</td>
                <td className="py-4 px-4 text-muted-foreground">
                  {new Date(res.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                  {new Date(res.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
                <td className="py-4 px-4">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold shadow-elevation-1 ${getStatusBadge(res.status)}`}>
                    {res.status === 'checked_in' ? 'Checked In' : res.status.charAt(0).toUpperCase() + res.status.slice(1)}
                  </span>
                </td>
                <td className="py-4 px-4">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${getSourceBadge(res.source)}`}>
                    {res.source.replace('_', ' ').charAt(0).toUpperCase() + res.source.slice(1).replace('_', ' ')}
                  </span>
                </td>
                <td className="py-4 px-4 text-right font-semibold text-foreground">₵{res.totalPrice}</td>
                <td className="py-4 px-4 text-center">
                  <ChevronRight className="h-4 w-4 text-muted-foreground mx-auto" />
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedReservation && (
        <ReservationDetailDrawer
          reservation={propertyReservations.find((r) => r.id === selectedReservation)!}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </>
  )
}

interface ReservationDetailDrawerProps {
  reservation: (typeof reservations)[0]
  onClose: () => void
}

function ReservationDetailDrawer({ reservation, onClose }: ReservationDetailDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onClose}></div>

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full md:w-96 surface-card shadow-elevation-4 z-50 overflow-y-auto rounded-l-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-foreground">Reservation Details</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-lg transition-colors md:hidden"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            <div className="surface-inset rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Booking Reference</p>
              <p className="text-lg font-bold text-foreground">{reservation.bookingRef}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Guest Information</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium text-foreground">{reservation.guestName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground text-sm">{reservation.guestEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-foreground">{reservation.guestPhone}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Reservation Details</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Room:</span>
                  <span className="font-medium text-foreground">{reservation.roomNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-in:</span>
                  <span className="font-medium text-foreground">
                    {new Date(reservation.checkInDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Check-out:</span>
                  <span className="font-medium text-foreground">
                    {new Date(reservation.checkOutDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nights:</span>
                  <span className="font-medium text-foreground">{reservation.numberOfNights}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Payment</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-bold text-lg text-foreground">₵{reservation.totalPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Paid:</span>
                  <span className="font-semibold text-foreground">₵{reservation.paidAmount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Outstanding:</span>
                  <span className="font-semibold text-destructive">₵{reservation.totalPrice - reservation.paidAmount}</span>
                </div>
              </div>
            </div>

            {reservation.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Notes</p>
                <p className="text-sm text-foreground surface-inset p-3 rounded-xl">{reservation.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

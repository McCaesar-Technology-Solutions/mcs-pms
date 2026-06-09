'use client'

import { Plus, Search, Calendar, Users, Zap } from 'lucide-react'

const MOCK_BOOKINGS = [
  {
    id: 'BK-001',
    guestName: 'Ama Mensah',
    roomType: 'Deluxe Suite',
    rooms: 1,
    checkIn: '2026-06-10',
    checkOut: '2026-06-14',
    guests: 2,
    status: 'confirmed',
    source: 'direct',
  },
  {
    id: 'BK-002',
    guestName: 'Kwame Asante',
    roomType: 'Standard Room',
    rooms: 1,
    checkIn: '2026-06-12',
    checkOut: '2026-06-15',
    guests: 1,
    status: 'pending',
    source: 'airbnb',
  },
  {
    id: 'BK-003',
    guestName: 'Abena Osei',
    roomType: 'Family Room',
    rooms: 2,
    checkIn: '2026-06-15',
    checkOut: '2026-06-22',
    guests: 4,
    status: 'confirmed',
    source: 'booking.com',
  },
]

export function BookingsManager() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-amber-600 text-amber-50'
      case 'pending':
        return 'bg-amber-600 text-amber-50'
      case 'cancelled':
        return 'bg-red-600 text-red-50'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'direct':
        return 'bg-blue-100 text-blue-700'
      case 'airbnb':
        return 'bg-orange-100 text-orange-700'
      case 'booking.com':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="surface-card stat-tile stat-tile-emerald p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Confirmed</p>
          <p className="text-4xl font-bold text-foreground mt-3">2</p>
          <p className="text-xs text-muted-foreground mt-2">bookings this week</p>
        </div>

        <div className="surface-card stat-tile stat-tile-amber p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Pending Confirmation</p>
          <p className="text-4xl font-bold text-foreground mt-3">1</p>
          <p className="text-xs text-muted-foreground mt-2">awaiting response</p>
        </div>

        <div className="surface-card stat-tile stat-tile-blue p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Room Occupancy</p>
          <p className="text-4xl font-bold text-foreground mt-3">5/8</p>
          <p className="text-xs text-muted-foreground mt-2">rooms booked today</p>
        </div>
      </div>

      <div className="surface-card">
        <div className="surface-card-header flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">All Bookings</h2>
            <p className="text-sm text-muted-foreground mt-1">{MOCK_BOOKINGS.length} active bookings</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold shadow-elevation-1 hover:shadow-elevation-2 transition-all hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            New Booking
          </button>
        </div>

        <div className="surface-card-header">
          <div className="flex items-center gap-3 surface-inset rounded-xl px-4 py-2.5">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search bookings..."
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Guest & Booking ID</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Room Type</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Dates</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Source</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Guests</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Status</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {MOCK_BOOKINGS.map((booking) => (
                <tr
                  key={booking.id}
                  className="cursor-pointer"
                >
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground">{booking.guestName}</p>
                    <p className="text-xs text-muted-foreground">{booking.id}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-medium text-foreground">{booking.roomType}</p>
                    <p className="text-xs text-muted-foreground">{booking.rooms} room(s)</p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(booking.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(booking.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getSourceColor(booking.source)}`}>
                      {booking.source.replace('.', '').charAt(0).toUpperCase() + booking.source.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
                      <Users className="h-4 w-4" />
                      {booking.guests}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(booking.status)} shadow-elevation-1`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                      <Zap className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

'use client'

import { reservations } from '@/lib/mock-data'

export function ReservationsGantt() {
  const today = new Date()
  const days = 30
  const dateRange = Array.from({ length: days }, (_, i) => {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    return date.toISOString().split('T')[0]
  })

  const getReservationColor = (source: string) => {
    switch (source) {
      case 'website':
        return 'bg-primary'
      case 'airbnb':
        return 'bg-blue-500'
      case 'booking':
        return 'bg-purple-500'
      case 'walk_in':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="surface-card overflow-x-auto p-6">
      <div className="surface-card-accent" />
      <h3 className="relative text-lg font-semibold text-foreground mb-4">Occupancy Timeline (30 Days)</h3>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-semibold text-foreground sticky left-0 bg-card z-10 w-24">Room</th>
            {dateRange.map((date) => (
              <th key={date} className="text-center py-2 px-1 font-semibold text-foreground text-xs h-12">
                <div>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).split(' ')[1]}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reservations.slice(0, 5).map((res, idx) => (
            <tr key={idx} className="shadow-[0_-1px_0_rgba(29,158,117,0.06)_inset]">
              <td className="py-3 px-3 font-medium text-foreground sticky left-0 bg-card z-10 w-24">
                {res.roomNumber}
              </td>
              {dateRange.map((date) => {
                const isInRange = date >= res.checkInDate && date < res.checkOutDate
                return (
                  <td key={date} className="py-3 px-1 text-center">
                    {isInRange && (
                      <div
                        className={`h-8 rounded text-white text-xs font-medium flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${getReservationColor(res.source)}`}
                        title={res.guestName}
                      >
                        {date === res.checkInDate && '→'}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-6 mt-6 flex-wrap">
        {(['website', 'airbnb', 'booking', 'walk_in'] as const).map((source) => (
          <div key={source} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${
              source === 'website' ? 'bg-primary' :
              source === 'airbnb' ? 'bg-blue-500' :
              source === 'booking' ? 'bg-purple-500' :
              'bg-orange-500'
            }`}></div>
            <span className="text-sm text-muted-foreground capitalize">{source.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

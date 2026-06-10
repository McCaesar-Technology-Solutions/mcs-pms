'use client'

import { rooms as mockRooms } from '@/lib/mock-data'
import { useProperty } from '@/lib/property-context'
import type { Room } from '@/types'

const statusConfig = {
  occupied: { label: 'Occupied', color: 'bg-primary text-primary-foreground' },
  vacant: { label: 'Vacant', color: 'bg-amber-100 text-amber-700' },
  reserved: { label: 'Reserved', color: 'bg-blue-100 text-blue-700' },
  dirty: { label: 'Dirty', color: 'bg-orange-100 text-orange-700' },
  maintenance: { label: 'Maintenance', color: 'bg-red-100 text-red-700' },
}

export function RoomStatusGrid({ rooms, title }: { rooms?: Room[]; title?: string }) {
  const { activeProperty } = useProperty()
  const displayRooms = rooms ?? mockRooms.filter((r) => r.propertyId === activeProperty.id).slice(0, 16)
  const heading = title ?? `${activeProperty.name} - Room Status`

  return (
    <div className="surface-card p-6">
      <div className="surface-card-accent" />
      <h3 className="relative text-lg font-semibold text-foreground mb-6">{heading}</h3>

      {displayRooms.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No rooms to display.</p>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-6">
          {displayRooms.map((room) => {
            const config = statusConfig[room.status]
            return (
              <button
                key={room.id}
                className={`aspect-square rounded-lg font-bold text-sm transition-transform hover:scale-110 ${config.color}`}
                title={`${room.number} - ${config.label}`}
              >
                {room.number}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.entries(statusConfig) as [keyof typeof statusConfig, (typeof statusConfig)[keyof typeof statusConfig]][]).map(
          ([status, config]) => {
            const count = displayRooms.filter((r) => r.status === status).length
            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded ${config.color.split(' ')[0]}`}></div>
                <span className="text-sm text-muted-foreground">{config.label}</span>
                <span className="text-sm font-semibold text-foreground">({count})</span>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

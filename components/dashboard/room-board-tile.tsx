'use client'

import Link from 'next/link'
import { ClipboardCheck, LogIn, LogOut, ShieldCheck, Sparkles, Wrench } from 'lucide-react'
import type { DbRoom, DbRoomStatus } from '@/types'
import type { RoomBoardSignal, StaffRoutePrefix } from '@/lib/data/front-desk-ops'

const TILE_TONE: Record<DbRoomStatus, string> = {
  available: 'room-board-tile--available',
  occupied: 'room-board-tile--occupied',
  cleaning: 'room-board-tile--cleaning',
  needs_inspection: 'room-board-tile--inspect',
  maintenance: 'room-board-tile--maintenance',
}

interface RoomBoardTileProps {
  room: DbRoom
  signal?: RoomBoardSignal
  routePrefix: StaffRoutePrefix
  categoryLabel?: string
  onRoomClick?: (room: DbRoom) => void
  selected?: boolean
}

export function RoomBoardTile({
  room,
  signal,
  routePrefix,
  categoryLabel,
  onRoomClick,
  selected = false,
}: RoomBoardTileProps) {
  const status = (room.status ?? 'available') as DbRoomStatus
  const tone = TILE_TONE[status]

  const reservationHref = signal?.arrivalReservationId
    ? `${routePrefix}/reservations?open=${signal.arrivalReservationId}`
    : signal?.departureReservationId
      ? `${routePrefix}/reservations?open=${signal.departureReservationId}`
      : null

  const inner = (
    <>
      <span className="room-board-tile__number">{room.number}</span>
      {categoryLabel && (
        <span className="room-board-tile__category">{categoryLabel}</span>
      )}
      <span className="room-board-tile__signals">
        {signal?.arrivalToday && (
          <span className="room-board-tile__signal room-board-tile__signal--arrival" title="Arrival today">
            <LogIn className="h-3 w-3" aria-hidden />
          </span>
        )}
        {signal?.departureToday && (
          <span className="room-board-tile__signal room-board-tile__signal--departure" title="Departure today">
            <LogOut className="h-3 w-3" aria-hidden />
          </span>
        )}
        {signal?.housekeeping === 'cleaning' && (
          <span className="room-board-tile__signal room-board-tile__signal--cleaning" title="Cleaning">
            <Sparkles className="h-3 w-3" aria-hidden />
          </span>
        )}
        {signal?.housekeeping === 'needs_inspection' && (
          <span className="room-board-tile__signal room-board-tile__signal--inspect" title="Needs inspection">
            <ClipboardCheck className="h-3 w-3" aria-hidden />
          </span>
        )}
        {signal?.maintenance && (
          <span className="room-board-tile__signal room-board-tile__signal--maintenance" title="Maintenance">
            <Wrench className="h-3 w-3" aria-hidden />
          </span>
        )}
        {signal?.prepaidArrival && (
          <span className="room-board-tile__signal room-board-tile__signal--prepaid" title="Prepaid arrival">
            <ShieldCheck className="h-3 w-3" aria-hidden />
          </span>
        )}
      </span>
    </>
  )

  const className = `room-board-tile ${tone} ${selected ? 'room-board-tile--selected' : ''}`

  if (onRoomClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => onRoomClick(room)}
        title={`Room ${room.number}`}
      >
        {inner}
      </button>
    )
  }

  if (reservationHref) {
    return (
      <Link href={reservationHref} className={className} title={`Room ${room.number}`}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={className} title={`Room ${room.number}`}>
      {inner}
    </div>
  )
}

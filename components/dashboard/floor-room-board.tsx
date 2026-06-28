'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { RoomBoardTile } from '@/components/dashboard/room-board-tile'
import {
  computeFloorSummary,
  groupRoomsByFloor,
  type RoomBoardSignal,
  type StaffRoutePrefix,
} from '@/lib/data/front-desk-ops'
import type { DbRoom, DbRoomStatus } from '@/types'

interface FloorRoomBoardProps {
  rooms: DbRoom[]
  signals: Map<string, RoomBoardSignal>
  routePrefix: StaffRoutePrefix
  filter?: 'dirty' | 'maintenance' | 'all'
  onRoomClick?: (room: DbRoom) => void
  selectedRoomIds?: Set<string>
  categoryLabel?: (room: DbRoom) => string
}

function summaryPill(label: string, count: number, tone: string) {
  if (count <= 0) return null
  return (
    <span key={label} className={`floor-board__pill floor-board__pill--${tone}`}>
      {String(count).padStart(2, '0')} {label}
    </span>
  )
}

function roomMatchesFilter(status: DbRoomStatus, filter: FloorRoomBoardProps['filter']): boolean {
  if (!filter || filter === 'all') return true
  if (filter === 'dirty') return status === 'cleaning' || status === 'needs_inspection'
  if (filter === 'maintenance') return status === 'maintenance'
  return true
}

export function FloorRoomBoard({
  rooms,
  signals,
  routePrefix,
  filter = 'all',
  onRoomClick,
  selectedRoomIds,
  categoryLabel,
}: FloorRoomBoardProps) {
  const floors = useMemo(() => groupRoomsByFloor(rooms), [rooms])
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(floors.map((f) => f.floor)))

  const filteredFloors = useMemo(() => {
    return floors
      .map(({ floor, rooms: floorRooms }) => {
        const filtered = floorRooms.filter((r) =>
          roomMatchesFilter((r.status ?? 'available') as DbRoomStatus, filter),
        )
        return { floor, rooms: filtered }
      })
      .filter((f) => f.rooms.length > 0)
  }, [floors, filter])

  function toggleFloor(floor: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(floor)) next.delete(floor)
      else next.add(floor)
      return next
    })
  }

  if (filteredFloors.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {filter === 'dirty'
          ? 'No rooms need cleaning or inspection.'
          : filter === 'maintenance'
            ? 'No rooms in maintenance.'
            : 'No rooms to display.'}
      </p>
    )
  }

  return (
    <div className="floor-board">
      {filteredFloors.map(({ floor, rooms: floorRooms }) => {
        const summary = computeFloorSummary(floor, floorRooms, signals)
        const isOpen = expanded.has(floor)

        return (
          <section key={floor} className="floor-board__section">
            <button
              type="button"
              className="floor-board__header"
              aria-expanded={isOpen}
              onClick={() => toggleFloor(floor)}
            >
              <div className="floor-board__header-main">
                <span className="floor-board__floor-num">{String(floor).padStart(2, '0')}</span>
                <div className="min-w-0 text-left">
                  <p className="floor-board__title">{summary.label}</p>
                  <p className="floor-board__meta">{summary.total} rooms</p>
                </div>
              </div>

              <div className="floor-board__pills">
                {summaryPill('Occupied', summary.occupied, 'occupied')}
                {summaryPill('Vacant', summary.vacant, 'vacant')}
                {summaryPill('Dirty', summary.dirty, 'dirty')}
                {summaryPill('Repairs', summary.maintenance, 'maintenance')}
                {summaryPill('Entry', summary.arrivals, 'arrival')}
                {summaryPill('Exit', summary.departures, 'departure')}
              </div>

              <ChevronDown
                className={`floor-board__chevron h-5 w-5 shrink-0 ${isOpen ? 'floor-board__chevron--open' : ''}`}
                aria-hidden
              />
            </button>

            {isOpen && (
              <div className="floor-board__grid">
                {floorRooms.map((room) => (
                  <RoomBoardTile
                    key={room.id}
                    room={room}
                    signal={signals.get(room.id)}
                    routePrefix={routePrefix}
                    categoryLabel={categoryLabel?.(room)}
                    onRoomClick={onRoomClick}
                    selected={selectedRoomIds?.has(room.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

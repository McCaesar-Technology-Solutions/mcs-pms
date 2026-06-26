'use client'

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { useProperty } from '@/lib/property-context'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import type { Room } from '@/types'

const statusConfig = {
  occupied: { label: 'Occupied', color: 'bg-primary text-primary-foreground' },
  vacant: { label: 'Vacant', color: 'bg-amber-100 text-amber-700' },
  reserved: { label: 'Reserved', color: 'bg-blue-100 text-blue-700' },
  dirty: { label: 'Dirty', color: 'bg-orange-100 text-orange-700' },
  maintenance: { label: 'Maintenance', color: 'bg-red-100 text-red-700' },
}

export function RoomStatusGrid({
  rooms,
  title,
  openTasksByRoom,
  housekeepingHref = '/manager/housekeeping',
}: {
  rooms: Room[]
  title?: string
  openTasksByRoom?: Map<string, HousekeepingTaskView>
  housekeepingHref?: string
}) {
  const { activeProperty } = useProperty()
  const heading = title ?? `${activeProperty.name} - Room Status`

  if (rooms.length === 0) {
    return (
      <DataEmptyState title={heading} message="No rooms configured for this property yet." />
    )
  }

  return (
    <div className="surface-card p-6">
      <div className="surface-card-accent" />
      <h3 className="relative mb-6 text-lg font-semibold text-foreground">{heading}</h3>

      <div className="mb-6 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {rooms.map((room) => {
          const config = statusConfig[room.status]
          const openTask = openTasksByRoom?.get(room.id)

          const tile = (
            <div
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-bold transition-transform hover:scale-110 ${config.color}`}
              title={
                openTask
                  ? `${room.number} — ${openTask.taskType} task (${openTask.status})`
                  : `${room.number} - ${config.label}`
              }
            >
              {room.number}
              {openTask && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#3C216C] shadow-elevation-1">
                  <ClipboardList className="h-3 w-3" />
                </span>
              )}
            </div>
          )

          if (openTask && housekeepingHref) {
            return (
              <Link key={room.id} href={housekeepingHref} className="block">
                {tile}
              </Link>
            )
          }

          return (
            <div key={room.id} className="block">
              {tile}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.entries(statusConfig) as [keyof typeof statusConfig, (typeof statusConfig)[keyof typeof statusConfig]][]).map(
          ([status, config]) => {
            const count = rooms.filter((r) => r.status === status).length
            return (
              <div key={status} className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded ${config.color.split(' ')[0]}`} />
                <span className="text-sm text-muted-foreground">{config.label}</span>
                <span className="text-sm font-semibold text-foreground">({count})</span>
              </div>
            )
          },
        )}
      </div>
    </div>
  )
}

'use client'

import { staffMembers } from '@/lib/mock-data'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function StaffAvailability() {
  const statusConfig = {
    available: { label: 'Available', pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
    busy: { label: 'Busy', pill: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
    off: { label: 'Off', pill: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-[#111827]">Staff Availability</h3>
        <p className="mt-1 text-sm text-muted-foreground">{staffMembers.length} team members on shift</p>
      </div>

      <div className="p-4">
        <div className="card-list-tray space-y-3">
          {staffMembers.map((staff) => {
            const config = statusConfig[staff.status as keyof typeof statusConfig]

            return (
              <div
                key={staff.id}
                className="elevated-list-item flex items-center justify-between gap-3 p-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                    {getInitials(staff.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111827]">{staff.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{staff.role}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                  <span className="rounded-full bg-[#faf8fc] px-2.5 py-1 text-[11px] font-semibold text-[#374151]">
                    {staff.shift}
                  </span>
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${config.pill}`}
                  >
                    <div className={`h-2 w-2 rounded-full ${config.dot}`} />
                    {config.label}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

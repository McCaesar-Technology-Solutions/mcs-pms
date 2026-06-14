'use client'

import type { Profile, UserRole } from '@/types'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const ROLE_LABEL: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  receptionist: 'Receptionist',
  technician: 'Technician',
}

export function StaffAvailability({ staff }: { staff: Profile[] }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-[#111827]">Staff</h3>
        <p className="mt-1 text-sm text-muted-foreground">{staff.length} team members</p>
      </div>

      <div className="p-4">
        <div className="card-list-tray space-y-3">
          {staff.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No staff yet.</p>
          )}
          {staff.map((member) => {
            const active = member.is_active !== false
            return (
              <div
                key={member.id}
                className="elevated-list-item flex items-center justify-between gap-3 p-3.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                    {getInitials(member.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#111827]">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.specialty ?? ROLE_LABEL[member.role]}
                    </p>
                  </div>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    active ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full ${active ? 'bg-amber-500' : 'bg-gray-400'}`} />
                  {active ? 'Active' : 'Disabled'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

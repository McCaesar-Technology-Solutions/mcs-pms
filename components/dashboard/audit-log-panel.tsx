'use client'

import { ClipboardList } from 'lucide-react'
import type { AuditLogEntry } from '@/lib/data/audit-log'

function formatWhen(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function entityLabel(type: string) {
  switch (type) {
    case 'reservation':
      return 'Reservation'
    case 'room':
      return 'Room'
    case 'room_category':
      return 'Category'
    case 'hotel':
      return 'Property'
    case 'staff':
      return 'Staff'
    case 'guest':
      return 'Guest'
    case 'invoice':
      return 'Invoice'
    case 'complaint':
      return 'Complaint'
    default:
      return type
  }
}

interface AuditLogPanelProps {
  entries: AuditLogEntry[]
  compact?: boolean
}

export function AuditLogPanel({ entries, compact = false }: AuditLogPanelProps) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Activity log</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Check-ins, bookings, rate changes, room updates, and property settings.
            </p>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No activity recorded yet. Check-ins, reservations, room changes, and settings updates appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-foreground">When</th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">Who</th>
                {!compact && (
                  <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                )}
                <th className="px-4 py-3 text-left font-semibold text-foreground">Summary</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#FAFDFF]">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatWhen(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {entry.actorName?.trim() || 'Staff'}
                  </td>
                  {!compact && (
                    <td className="px-4 py-3 text-muted-foreground">
                      {entityLabel(entry.entityType)}
                    </td>
                  )}
                  <td className="px-4 py-3 text-foreground">{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

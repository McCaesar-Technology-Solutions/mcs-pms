'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell } from 'lucide-react'
import { updateGuestRequestStatus } from '@/app/actions/guest-portal-staff'

export interface GuestRequestRow {
  id: string
  requestType: string
  note: string | null
  status: string
  createdAt: string
  guestName: string
  roomNumber: string | null
}

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  late_checkout: 'Late checkout',
  extension: 'Stay extension',
  self_checkout: 'Self check-out',
}

interface GuestRequestsPanelProps {
  hotelId: string
  initialRequests?: GuestRequestRow[]
}

export function GuestRequestsPanel({ hotelId, initialRequests = [] }: GuestRequestsPanelProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setRequests(initialRequests)
  }, [initialRequests])

  function updateStatus(id: string, status: 'acknowledged' | 'completed' | 'declined') {
    startTransition(async () => {
      const result = await updateGuestRequestStatus(id, status)
      if (result.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r)),
        )
      }
    })
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')

  if (requests.length === 0) return null

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#3C216C]" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Guest requests</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Housekeeping, late checkout, extensions, and self check-out from the guest portal.
              {pendingRequests.length > 0 && (
                <span className="ml-1 font-semibold text-[#D85A30]">
                  {pendingRequests.length} pending
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <ul className="divide-y divide-border/60 border-t border-border/60">
        {requests.slice(0, 10).map((req) => (
          <li key={req.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {REQUEST_LABELS[req.requestType] ?? req.requestType}
                {req.roomNumber ? ` · Room ${req.roomNumber}` : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {req.guestName} ·{' '}
                {new Date(req.createdAt).toLocaleString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {req.note && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{req.note}</p>
              )}
            </div>
            {req.status === 'pending' ? (
              <div className="flex flex-wrap gap-1.5">
                {(['acknowledged', 'completed', 'declined'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={pending}
                    onClick={() => updateStatus(req.id, status)}
                    className="rounded-lg bg-[#3C216C]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#3C216C] hover:bg-[#3C216C]/15 disabled:opacity-50"
                  >
                    {status}
                  </button>
                ))}
              </div>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {req.status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

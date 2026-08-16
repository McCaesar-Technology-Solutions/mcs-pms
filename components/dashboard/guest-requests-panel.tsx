'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import { toast } from 'sonner'
import {
  scheduleGuestHousekeepingRequest,
  updateGuestRequestStatus,
} from '@/app/actions/guest-portal-staff'

export interface GuestRequestRow {
  id: string
  requestType: string
  note: string | null
  requestedDate?: string | null
  requestedTime?: string | null
  status: string
  createdAt: string
  guestName: string
  roomNumber: string | null
  doNotDisturb: boolean
  reservationId: string | null
  housekeepingTaskId?: string | null
  housekeepingTaskStatus?: string | null
}

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  late_checkout: 'Late checkout',
  extension: 'Stay extension',
  self_checkout: 'Self check-out',
}

const HOUSEKEEPING_TASK_LABELS: Record<string, string> = {
  todo: 'Cleaning scheduled',
  in_progress: 'Cleaning in progress',
  done: 'Cleaning complete',
}

interface GuestRequestsPanelProps {
  hotelId: string
  initialRequests?: GuestRequestRow[]
  reservationsHrefBase?: string
  housekeepingHrefBase?: string | null
}

function formatRequestedDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isEditableRequestStatus(status: string) {
  return status === 'pending' || status === 'acknowledged'
}

function statusActions(status: string): Array<'acknowledged' | 'completed' | 'declined'> {
  if (status === 'pending') return ['acknowledged', 'completed', 'declined']
  if (status === 'acknowledged') return ['completed', 'declined']
  return []
}

export function GuestRequestsPanel({
  initialRequests = [],
  reservationsHrefBase = '/manager/reservations',
  housekeepingHrefBase = '/manager/housekeeping',
}: GuestRequestsPanelProps) {
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
          prev.map((r) => {
            if (r.id !== id) return r
            const taskId = result.data?.housekeepingTaskId ?? r.housekeepingTaskId ?? null
            return {
              ...r,
              status,
              housekeepingTaskId: taskId,
              housekeepingTaskStatus:
                taskId && !r.housekeepingTaskStatus ? 'todo' : r.housekeepingTaskStatus,
            }
          }),
        )
        toast.success(`Request marked as ${status}.`)
      } else {
        toast.error(result.error ?? 'Could not update request.')
      }
    })
  }

  function scheduleCleaning(id: string) {
    startTransition(async () => {
      const result = await scheduleGuestHousekeepingRequest(id)
      if (!result.success) {
        toast.error(result.error ?? 'Could not schedule cleaning.')
        return
      }
      const taskId = result.data?.taskId
      if (taskId) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  housekeepingTaskId: taskId,
                  housekeepingTaskStatus: 'todo',
                }
              : r,
          ),
        )
        toast.success('Cleaning task scheduled.')
      }
    })
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const visibleRequests = [...requests].sort((a, b) => {
    const aOpen = isEditableRequestStatus(a.status) ? 0 : 1
    const bOpen = isEditableRequestStatus(b.status) ? 0 : 1
    if (aOpen !== bOpen) return aOpen - bOpen
    return b.createdAt.localeCompare(a.createdAt)
  })

  return (
    <div id="guest-requests" className="surface-card overflow-hidden scroll-mt-24">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[var(--comp-sand)]" />
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

      {requests.length === 0 ? (
        <p className="list-empty text-sm text-muted-foreground">
          No guest requests yet. Requests from the guest portal Stay tab will appear here.
        </p>
      ) : (
        <div className="list-stack">
          {visibleRequests.map((req) => (
            <div
              key={req.id}
              className="list-row flex-wrap items-center justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {REQUEST_LABELS[req.requestType] ?? req.requestType}
                  {req.roomNumber ? ` · Room ${req.roomNumber}` : ''}
                </p>
                <p className="text-xs text-muted-foreground inline-flex flex-wrap items-center gap-1.5">
                  {req.guestName}
                  {req.doNotDisturb && <GuestDndBadge compact />}
                  <span aria-hidden>·</span>
                  {new Date(req.createdAt).toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {req.note && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{req.note}</p>
                )}
                {req.requestType === 'extension' && req.requestedDate && (
                  <p className="mt-1 text-xs font-medium text-foreground">
                    Requested new check-out: {formatRequestedDate(req.requestedDate)}
                  </p>
                )}
                {req.requestType === 'late_checkout' && req.requestedTime && (
                  <p className="mt-1 text-xs font-medium text-foreground">
                    Requested checkout time: {req.requestedTime}
                  </p>
                )}
                {req.requestType === 'housekeeping' && req.housekeepingTaskStatus && (
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {HOUSEKEEPING_TASK_LABELS[req.housekeepingTaskStatus] ??
                      `Task · ${req.housekeepingTaskStatus.replace(/_/g, ' ')}`}
                  </p>
                )}
              </div>
              {isEditableRequestStatus(req.status) ? (
                <div className="flex flex-wrap gap-1.5">
                  {req.requestType === 'extension' && req.reservationId && req.requestedDate && (
                    <Link
                      href={`${reservationsHrefBase}?open=${encodeURIComponent(req.reservationId)}&extend=1&extendDate=${encodeURIComponent(req.requestedDate)}&guestRequest=${encodeURIComponent(req.id)}`}
                      className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                    >
                      Extend stay
                    </Link>
                  )}
                  {req.requestType === 'housekeeping' &&
                    housekeepingHrefBase &&
                    req.housekeepingTaskId && (
                      <Link
                        href={`${housekeepingHrefBase}?task=${encodeURIComponent(req.housekeepingTaskId)}&guestRequest=${encodeURIComponent(req.id)}`}
                        className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                      >
                        View task
                      </Link>
                    )}
                  {req.requestType === 'housekeeping' && !req.housekeepingTaskId && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => scheduleCleaning(req.id)}
                      className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-50"
                    >
                      Schedule cleaning
                    </button>
                  )}
                  {statusActions(req.status).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={pending}
                      onClick={() => updateStatus(req.id, status)}
                      className="rounded-lg bg-[var(--comp-teal-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--comp-teal-ink)] hover:bg-[var(--comp-teal)]/15 disabled:opacity-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {req.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

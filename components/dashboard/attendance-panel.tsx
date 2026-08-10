'use client'

import { useState, useTransition } from 'react'
import { Clock } from 'lucide-react'
import { requestAttendancePull } from '@/app/actions/access-control'
import type { AttendanceRecordRow } from '@/lib/access/types'

type Props = {
  hotelId: string
  records: AttendanceRecordRow[]
}

export function AttendancePanel({ hotelId, records }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Staff attendance</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Clock events from DS-K1A8503MF-B. Tenants are never included.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="app-btn app-btn-secondary"
            disabled={pending}
            onClick={() => {
              setError(null)
              setMessage(null)
              startTransition(async () => {
                const result = await requestAttendancePull(hotelId)
                if (!result.success) setError(result.error)
                else setMessage('Attendance pull queued for the on-site agent.')
              })
            }}
          >
            Pull from terminal
          </button>
        </div>
      </div>
      <div className="surface-card-body overflow-x-auto">
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendance records yet. Save an attendance terminal under Access, then pull.
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">Staff</th>
                <th className="pb-2 pr-3 font-medium">Event</th>
                <th className="pb-2 pr-3 font-medium">When</th>
                <th className="pb-2 font-medium">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 pr-3">
                    <div className="font-medium">{r.display_name ?? r.employee_no}</div>
                    <div className="text-xs text-muted-foreground">#{r.employee_no}</div>
                  </td>
                  <td className="py-3 pr-3">{r.event_type}</td>
                  <td className="py-3 pr-3">
                    {new Date(r.occurred_at).toLocaleString()}
                  </td>
                  <td className="py-3">{r.device_key ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        {message && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
        )}
      </div>
    </div>
  )
}

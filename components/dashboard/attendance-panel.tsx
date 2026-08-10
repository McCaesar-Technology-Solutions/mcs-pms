'use client'

import { useState, useTransition } from 'react'
import { Clock } from 'lucide-react'
import { requestAttendancePull } from '@/app/actions/access-control'
import type { AccessJobRow, AttendanceRecordRow } from '@/lib/access/types'

type Props = {
  hotelId: string
  records: AttendanceRecordRow[]
  /** Most recent pull_attendance job (any status) for status surfacing. */
  lastPullJob?: AccessJobRow | null
}

function pullJobNote(job: AccessJobRow | null | undefined): {
  kind: 'error' | 'ok' | 'pending' | null
  text: string | null
} {
  if (!job) return { kind: null, text: null }
  if (job.status === 'failed' || job.status === 'dead') {
    return {
      kind: 'error',
      text: job.last_error ?? 'Last attendance pull failed.',
    }
  }
  if (job.status === 'pending' || job.status === 'claimed') {
    return { kind: 'pending', text: 'Attendance pull is waiting on the on-site agent…' }
  }
  if (job.status === 'succeeded') {
    const result = job.result && typeof job.result === 'object' && !Array.isArray(job.result)
      ? (job.result as Record<string, unknown>)
      : null
    const count = Array.isArray(result?.records) ? result.records.length : null
    return {
      kind: 'ok',
      text:
        count != null
          ? `Last pull succeeded (${count} event${count === 1 ? '' : 's'} from terminal).`
          : 'Last pull succeeded.',
    }
  }
  return { kind: null, text: null }
}

export function AttendancePanel({ hotelId, records, lastPullJob }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const note = pullJobNote(lastPullJob)

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
                Clock events from DS-K1A8503MF-B via Access Agent AcsEvent pull. Tenants are never
                included. Re-pulls do not duplicate punches.
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
            No attendance records yet. Save an attendance terminal under Access (role: Attendance),
            install Access Agent 1.3.8+, then pull.
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
        {!error && note.kind === 'error' && note.text ? (
          <p className="mt-3 text-sm text-destructive">{note.text}</p>
        ) : null}
        {message && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
        )}
        {!message && note.kind === 'ok' && note.text ? (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{note.text}</p>
        ) : null}
        {!message && note.kind === 'pending' && note.text ? (
          <p className="mt-3 text-sm text-muted-foreground">{note.text}</p>
        ) : null}
      </div>
    </div>
  )
}

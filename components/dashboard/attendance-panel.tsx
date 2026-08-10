'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Clock, Search } from 'lucide-react'
import { requestAttendancePull } from '@/app/actions/access-control'
import { AccessFeedback } from '@/components/dashboard/access-feedback'
import type { AccessJobRow, AttendanceRecordRow } from '@/lib/access/types'

type Props = {
  hotelId: string
  records: AttendanceRecordRow[]
  /** Most recent pull_attendance job (any status) for status surfacing. */
  lastPullJob?: AccessJobRow | null
  hasAttendanceDevice?: boolean
  agentOnline?: boolean
  /** Owner can deep-link to Setup; manager gets plain copy. */
  canOpenSetup?: boolean
}

type WindowFilter = 'today' | '48h' | 'all'

function startOfLocalDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function relativeWhen(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  const diffMs = Date.now() - t
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return new Date(iso).toLocaleString()
}

function eventBadge(eventType: AttendanceRecordRow['event_type']): {
  label: string
  className: string
} {
  if (eventType === 'clock_in') {
    return {
      label: 'Clock in',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    }
  }
  if (eventType === 'clock_out') {
    return {
      label: 'Clock out',
      className: 'bg-sky-500/15 text-sky-800 dark:text-sky-300',
    }
  }
  return {
    label: 'Unknown',
    className: 'bg-muted text-muted-foreground',
  }
}

function pullSummary(job: AccessJobRow | null | undefined): {
  kind: 'error' | 'ok' | 'pending' | 'idle'
  text: string
} {
  if (!job) {
    return { kind: 'idle', text: 'No pull yet — tap Pull from terminal.' }
  }
  if (job.status === 'failed' || job.status === 'dead') {
    return {
      kind: 'error',
      text: `Last pull failed · ${job.last_error ?? 'see agent logs'}`,
    }
  }
  if (job.status === 'pending' || job.status === 'claimed') {
    return {
      kind: 'pending',
      text: `Pull in progress · queued ${relativeWhen(job.created_at)}`,
    }
  }
  if (job.status === 'succeeded') {
    const result =
      job.result && typeof job.result === 'object' && !Array.isArray(job.result)
        ? (job.result as Record<string, unknown>)
        : null
    const count = Array.isArray(result?.records) ? result.records.length : null
    const when = relativeWhen(job.updated_at)
    return {
      kind: 'ok',
      text:
        count != null
          ? `Last pull: ${when} · ${count} event${count === 1 ? '' : 's'} · OK`
          : `Last pull: ${when} · OK`,
    }
  }
  return { kind: 'idle', text: 'No successful pull yet.' }
}

function pullDisabledReason(input: {
  hasAttendanceDevice: boolean
  agentOnline: boolean
  pullPending: boolean
}): string | null {
  if (!input.hasAttendanceDevice) {
    return 'No attendance terminal saved'
  }
  if (!input.agentOnline) {
    return 'Agent offline — pull will wait until it reconnects'
  }
  if (input.pullPending) {
    return 'Pull already in progress'
  }
  return null
}

export function AttendancePanel({
  hotelId,
  records,
  lastPullJob,
  hasAttendanceDevice = true,
  agentOnline = true,
  canOpenSetup = false,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [windowFilter, setWindowFilter] = useState<WindowFilter>('48h')
  const [query, setQuery] = useState('')

  const summary = pullSummary(lastPullJob)
  const pullInFlight =
    lastPullJob?.status === 'pending' || lastPullJob?.status === 'claimed'
  const disabledReason = pullDisabledReason({
    hasAttendanceDevice,
    agentOnline,
    pullPending: pullInFlight || pending,
  })
  // Allow queueing even when agent offline (jobs wait) — only hard-block missing device / in-flight.
  const hardDisabled =
    !hasAttendanceDevice || pullInFlight || pending

  const filtered = useMemo(() => {
    const now = Date.now()
    const dayStart = startOfLocalDay().getTime()
    const cutoff48 = now - 48 * 3600_000
    const q = query.trim().toLowerCase()

    return records.filter((r) => {
      const t = new Date(r.occurred_at).getTime()
      if (Number.isNaN(t)) return false
      if (windowFilter === 'today' && t < dayStart) return false
      if (windowFilter === '48h' && t < cutoff48) return false
      if (!q) return true
      const name = (r.display_name ?? '').toLowerCase()
      const emp = r.employee_no.toLowerCase()
      return name.includes(q) || emp.includes(q)
    })
  }, [records, windowFilter, query])

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Clock events</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Staff clock-in and clock-out from the attendance terminal. Guests are never
                included. Pulling again will not create duplicates.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <button
              type="button"
              className="app-btn app-btn-primary h-11 min-w-[10rem]"
              disabled={hardDisabled}
              title={disabledReason ?? 'Pull last 48 hours from the terminal'}
              onClick={() => {
                setError(null)
                setMessage(null)
                startTransition(async () => {
                  const result = await requestAttendancePull(hotelId)
                  if (!result.success) setError(result.error)
                  else
                    setMessage(
                      agentOnline
                        ? 'Pull queued — events will appear when the agent finishes.'
                        : 'Pull queued — will run when the agent comes online.',
                    )
                })
              }}
            >
              Pull from terminal
            </button>
            {hardDisabled && disabledReason ? (
              <p className="text-xs text-muted-foreground">{disabledReason}</p>
            ) : !agentOnline && hasAttendanceDevice ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Agent offline — pull will wait.
              </p>
            ) : null}
          </div>
        </div>

        <p
          className={`flex items-start gap-2 text-sm ${
            summary.kind === 'error'
              ? 'text-destructive'
              : summary.kind === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : summary.kind === 'pending'
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-muted-foreground'
          }`}
          role="status"
        >
          {summary.kind === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : summary.kind === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : null}
          <span>{summary.text}</span>
        </p>

        {!hasAttendanceDevice ? (
          <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {canOpenSetup ? (
                <>
                  Save an attendance terminal under{' '}
                  <a href="#setup" className="font-medium text-foreground underline">
                    Setup → Devices
                  </a>
                  , then pull.
                </>
              ) : (
                <>Ask the owner to save an attendance terminal under Setup, then pull.</>
              )}
            </span>
          </p>
        ) : null}
      </div>

      <div className="surface-card-body space-y-3">
        {records.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['today', 'Today'],
                ['48h', 'Last 48h'],
                ['all', 'All'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`filter-pill filter-pill--sm access-touch-pill ${
                  windowFilter === id ? 'filter-pill--active' : ''
                }`}
                onClick={() => setWindowFilter(id)}
              >
                {label}
              </button>
            ))}
            <label className="app-search-field ml-auto min-h-11 min-w-[12rem] max-w-xs flex-1">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Filter by staff…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasAttendanceDevice
              ? 'No punches stored yet. Pull from the terminal after staff clock in.'
              : 'No attendance records yet.'}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events in this view.{' '}
            <button
              type="button"
              className="min-h-11 font-medium text-foreground underline"
              onClick={() => {
                setWindowFilter('all')
                setQuery('')
              }}
            >
              Show all
            </button>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {filtered.map((r) => {
              const badge = eventBadge(r.event_type)
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-1.5 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {r.display_name ?? r.employee_no}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      #{r.employee_no}
                      {r.device_key ? ' · attendance terminal' : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-sm text-foreground sm:text-right">
                    <div>{new Date(r.occurred_at).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{relativeWhen(r.occurred_at)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <AccessFeedback error={error} message={message} />
      </div>
    </div>
  )
}

import { CircleAlert, CircleCheck, ListTodo, Wifi, WifiOff } from 'lucide-react'
import type { AccessIntegrationSummary, AccessJobRow } from '@/lib/access/types'

type Props = {
  integration: AccessIntegrationSummary
  jobs: AccessJobRow[]
  lastPullJob?: AccessJobRow | null
  viewerRole: 'owner' | 'manager' | 'receptionist'
}

function openJobCount(jobs: AccessJobRow[]) {
  return jobs.filter(
    (j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'failed',
  ).length
}

function lastPullSummary(job: AccessJobRow | null | undefined): {
  kind: 'ok' | 'error' | 'pending'
  text: string
} | null {
  if (!job) return null
  if (job.status === 'pending' || job.status === 'claimed') {
    return { kind: 'pending', text: 'Attendance pull in progress…' }
  }
  if (job.status === 'failed' || job.status === 'dead') {
    return {
      kind: 'error',
      text: job.last_error ? `Last pull failed: ${job.last_error}` : 'Last attendance pull failed',
    }
  }
  if (job.status === 'succeeded') {
    const result =
      job.result && typeof job.result === 'object' && !Array.isArray(job.result)
        ? (job.result as Record<string, unknown>)
        : null
    const count = Array.isArray(result?.records) ? result.records.length : null
    const when = new Date(job.updated_at).toLocaleString()
    return {
      kind: 'ok',
      text:
        count != null
          ? `Last pull ${when} · ${count} event${count === 1 ? '' : 's'}`
          : `Last pull ${when}`,
    }
  }
  return null
}

export function AccessStatusStrip({
  integration,
  jobs,
  lastPullJob,
  viewerRole,
}: Props) {
  const online = integration.agentOnline
  const openJobs = openJobCount(jobs)
  const pullNote =
    viewerRole === 'receptionist' ? null : lastPullSummary(lastPullJob)
  const version = integration.agentVersion
  const host = integration.agentHostname

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
        {online ? (
          <Wifi className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        )}
        <span>{online ? 'Agent online' : 'Agent offline'}</span>
        <span className="sr-only">
          {online ? 'Door jobs can run now.' : 'Door jobs will wait until the agent reconnects.'}
        </span>
      </span>

      {version ? (
        <span className="text-muted-foreground">
          v{version}
          {host ? ` · ${host}` : ''}
        </span>
      ) : !online ? (
        <span className="text-muted-foreground">
          {viewerRole === 'owner'
            ? 'Install the agent under Setup when ready.'
            : 'Ask the owner if unlocks are not running.'}
        </span>
      ) : null}

      <span
        className={`inline-flex items-center gap-1.5 ${
          openJobs > 0 ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-muted-foreground'
        }`}
      >
        <ListTodo className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {openJobs === 0
          ? 'No open jobs'
          : `${openJobs} open job${openJobs === 1 ? '' : 's'}`}
      </span>

      {pullNote ? (
        <span
          className={`inline-flex min-w-0 flex-1 basis-full items-start gap-1.5 sm:basis-auto sm:items-center ${
            pullNote.kind === 'error'
              ? 'text-destructive'
              : pullNote.kind === 'ok'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-800 dark:text-amber-300'
          }`}
        >
          {pullNote.kind === 'error' ? (
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" aria-hidden />
          ) : pullNote.kind === 'ok' ? (
            <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" aria-hidden />
          ) : (
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" aria-hidden />
          )}
          <span className="sm:truncate">{pullNote.text}</span>
        </span>
      ) : null}
    </div>
  )
}

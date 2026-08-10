import { Circle, CircleAlert, CircleCheck, Wifi, WifiOff } from 'lucide-react'
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

function lastPullSummary(job: AccessJobRow | null | undefined): string | null {
  if (!job) return null
  if (job.status === 'pending' || job.status === 'claimed') return 'Attendance pull in progress…'
  if (job.status === 'failed' || job.status === 'dead') {
    return job.last_error ? `Last pull failed: ${job.last_error}` : 'Last attendance pull failed'
  }
  if (job.status === 'succeeded') {
    const result =
      job.result && typeof job.result === 'object' && !Array.isArray(job.result)
        ? (job.result as Record<string, unknown>)
        : null
    const count = Array.isArray(result?.records) ? result.records.length : null
    const when = new Date(job.updated_at).toLocaleString()
    return count != null
      ? `Last pull ${when} · ${count} event${count === 1 ? '' : 's'}`
      : `Last pull ${when}`
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
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 font-medium text-foreground">
        {online ? (
          <Wifi className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        )}
        {online ? (
          <>
            <CircleCheck className="sr-only" />
            Agent online
          </>
        ) : (
          <>
            <CircleAlert className="sr-only" />
            Agent offline
          </>
        )}
      </span>

      {version ? (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Circle className="h-2 w-2 fill-current opacity-40" aria-hidden />
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

      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Circle className="h-2 w-2 fill-current opacity-40" aria-hidden />
        {openJobs === 0
          ? 'No open jobs'
          : `${openJobs} open job${openJobs === 1 ? '' : 's'}`}
      </span>

      {pullNote ? (
        <span className="min-w-0 flex-1 basis-full text-muted-foreground sm:basis-auto sm:truncate">
          {pullNote}
        </span>
      ) : null}
    </div>
  )
}

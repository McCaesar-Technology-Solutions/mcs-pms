'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { ChevronDown, CreditCard, DoorOpen, ListTodo, MoreHorizontal, Search } from 'lucide-react'
import { AccessFeedback } from '@/components/dashboard/access-feedback'
import {
  assignAccessCard,
  cancelAccessJobAction,
  cancelOpenAccessJobsAction,
  clearAccessJobsAction,
  remoteUnlockDoor,
  retryAccessCredential,
  startEnrollmentCapture,
} from '@/app/actions/access-control'
import type {
  AccessCredentialRow,
  AccessDeviceRow,
  AccessPointRow,
  AccessJobRow,
  AccessJobStatus,
} from '@/lib/access/types'
import { receptionMayUnlockZone } from '@/lib/access/doors'

interface AccessOpsPanelProps {
  hotelId: string
  points: AccessPointRow[]
  credentials: AccessCredentialRow[]
  jobs: AccessJobRow[]
  devices?: AccessDeviceRow[]
  /** When receptionist, unlock list is limited to guest-facing zones. */
  viewerRole?: 'owner' | 'manager' | 'receptionist'
  /**
   * today = unlock + recent jobs (default daily ops)
   * guests = guest credential enroll only
   * all = legacy full stack
   */
  focus?: 'today' | 'guests' | 'all'
}

type JobFilter = 'all' | 'open' | 'failed' | 'pending'
type CaptureKind = 'card' | 'face' | 'fingerprint'

function lastUnlockStorageKey(hotelId: string) {
  return `mojo-access-last-unlock:${hotelId}`
}

function guestSyncChip(c: AccessCredentialRow): {
  label: string
  className: string
} {
  if (c.status === 'error' || c.sync_status === 'failed') {
    return {
      label: 'Error',
      className: 'bg-destructive/15 text-destructive',
    }
  }
  if (
    c.sync_status === 'pending' ||
    c.status === 'pending' ||
    c.status === 'revoking'
  ) {
    return {
      label: c.status === 'revoking' ? 'Revoking' : 'Pending',
      className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    }
  }
  if (c.sync_status === 'synced' && (c.status === 'active' || c.status === 'revoked')) {
    return {
      label: c.status === 'revoked' ? 'Revoked' : 'Synced',
      className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    }
  }
  return {
    label: c.status,
    className: 'bg-muted text-muted-foreground',
  }
}

function jobPriority(status: AccessJobStatus): number {
  switch (status) {
    case 'failed':
    case 'dead':
      return 0
    case 'claimed':
      return 1
    case 'pending':
      return 2
    default:
      return 3
  }
}

function jobStatusChip(status: AccessJobStatus): string {
  if (status === 'failed' || status === 'dead') {
    return 'bg-destructive/15 text-destructive'
  }
  if (status === 'pending' || status === 'claimed') {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  }
  if (status === 'succeeded') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  }
  return 'bg-muted text-muted-foreground'
}

function setupHint(viewerRole: 'owner' | 'manager' | 'receptionist') {
  if (viewerRole === 'owner') return 'Owner → Access → Setup'
  return 'Ask the owner to finish Setup'
}

export function AccessOpsPanel({
  hotelId,
  points,
  credentials,
  jobs,
  devices = [],
  viewerRole = 'manager',
  focus = 'all',
}: AccessOpsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({})
  const [guestQuery, setGuestQuery] = useState('')
  const [jobFilter, setJobFilter] = useState<JobFilter>(() => {
    const open = jobs.some(
      (j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'failed',
    )
    return open ? 'open' : 'all'
  })
  const [lastUnlockedId, setLastUnlockedId] = useState<string | null>(null)
  const [enrollMenuId, setEnrollMenuId] = useState<string | null>(null)
  const [moreMenuId, setMoreMenuId] = useState<string | null>(null)

  useEffect(() => {
    try {
      setLastUnlockedId(localStorage.getItem(lastUnlockStorageKey(hotelId)))
    } catch {
      setLastUnlockedId(null)
    }
  }, [hotelId])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (target?.closest('[data-access-menu]')) return
      setEnrollMenuId(null)
      setMoreMenuId(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const enrollmentStation = devices.find((d) => d.device_role === 'enrollment' && d.managed_in_cloud)
  const unlockPoints = points.filter(
    (p) =>
      p.is_active &&
      (viewerRole !== 'receptionist' || receptionMayUnlockZone(p.zone)),
  )
  const guestCredentials = credentials.filter((c) => (c.person_type ?? 'tenant') === 'tenant')
  const canBulkManageJobs = viewerRole !== 'receptionist'
  const showToday = focus === 'today' || focus === 'all'
  const showGuests = focus === 'guests' || focus === 'all'
  const isOwner = viewerRole === 'owner'

  const filteredGuests = useMemo(() => {
    const q = guestQuery.trim().toLowerCase()
    if (!q) return guestCredentials
    return guestCredentials.filter((c) => {
      const name = (c.guest_name ?? c.display_name ?? '').toLowerCase()
      const room = (c.room_number ?? '').toLowerCase()
      const emp = c.employee_no.toLowerCase()
      return name.includes(q) || room.includes(q) || emp.includes(q)
    })
  }, [guestCredentials, guestQuery])

  const filteredJobs = useMemo(() => {
    let list = [...jobs]
    if (jobFilter === 'open') {
      list = list.filter(
        (j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'failed',
      )
    } else if (jobFilter === 'failed') {
      list = list.filter((j) => j.status === 'failed' || j.status === 'dead')
    } else if (jobFilter === 'pending') {
      list = list.filter((j) => j.status === 'pending' || j.status === 'claimed')
    }
    list.sort((a, b) => {
      const byStatus = jobPriority(a.status) - jobPriority(b.status)
      if (byStatus !== 0) return byStatus
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [jobs, jobFilter])

  const openJobCount = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'claimed' || j.status === 'failed',
  ).length

  function run(action: () => Promise<void>) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      try {
        await action()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function rememberUnlock(pointId: string) {
    setLastUnlockedId(pointId)
    try {
      localStorage.setItem(lastUnlockStorageKey(hotelId), pointId)
    } catch {
      // ignore
    }
  }

  function queueEnroll(credentialId: string, capture: CaptureKind) {
    setEnrollMenuId(null)
    run(async () => {
      const result = await startEnrollmentCapture({
        hotelId,
        credentialId,
        capture,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      if (capture === 'card') {
        setMessage('Waiting for card — tap it on the enrollment station.')
      } else if (capture === 'face') {
        setMessage('Face enroll queued — face the enrollment station camera.')
      } else {
        setMessage('Fingerprint enroll queued — place finger on the station.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {showToday ? (
        <div className="surface-card overflow-hidden">
          <div className="surface-card-accent" />
          <div className="surface-card-header">
            <div className="flex items-center gap-3">
              <DoorOpen className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Unlock a door</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  One tap opens the door via the on-site agent. Every unlock is logged.
                </p>
              </div>
            </div>
          </div>
          <div className="surface-card-body">
            {unlockPoints.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No active doors to unlock yet.
                </p>
                <p className="text-sm text-muted-foreground">
                  {isOwner ? (
                    <>
                      Map physical doors under{' '}
                      <a href="#setup" className="font-medium text-foreground underline">
                        Setup
                      </a>
                      .
                    </>
                  ) : (
                    <>{setupHint(viewerRole)} — add physical doors first.</>
                  )}
                </p>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {unlockPoints.map((p) => {
                  const isLast = lastUnlockedId === p.id
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            const result = await remoteUnlockDoor({
                              hotelId,
                              accessPointId: p.id,
                            })
                            if (!result.success) {
                              setError(result.error)
                              return
                            }
                            rememberUnlock(p.id)
                            setMessage(`Unlock queued for ${p.label}.`)
                          })
                        }
                        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors sm:min-h-[4.5rem] ${
                          isLast
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {p.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {p.zone}
                            {p.room_number ? ` · Room ${p.room_number}` : ''}
                            {isLast ? ' · last unlocked' : ''}
                          </span>
                        </span>
                        <span
                          className={`inline-flex min-h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-lg px-3 text-sm font-semibold ${
                            isLast
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          Unlock
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {showGuests ? (
        <div className="surface-card overflow-hidden">
          <div className="surface-card-header space-y-3">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Issue guest access</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Guests sync on check-in. Enroll a card, face, or fingerprint at the front-desk
                  station — or type a card number under More.
                  {enrollmentStation ? (
                    <>
                      {' '}
                      Station:{' '}
                      <span className="font-medium text-foreground">{enrollmentStation.label}</span>
                      {enrollmentStation.is_online ? ' (online)' : ' (offline)'}.
                    </>
                  ) : (
                    <> No enrollment station yet — {setupHint(viewerRole)}.</>
                  )}
                </p>
              </div>
            </div>
            {guestCredentials.length > 0 ? (
              <label className="app-search-field max-w-md">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search guest, room, or #…"
                  value={guestQuery}
                  onChange={(e) => setGuestQuery(e.target.value)}
                />
              </label>
            ) : null}
          </div>
          <div className="surface-card-body">
            {guestCredentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No guest credentials yet. They appear after check-in when access sync is enabled.
              </p>
            ) : filteredGuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No guests match “{guestQuery.trim()}”.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {filteredGuests.map((c) => {
                  const chip = guestSyncChip(c)
                  const needsRetry = c.sync_status === 'failed' || c.status === 'error'
                  return (
                    <li
                      key={c.id}
                      className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {c.guest_name ?? c.display_name}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${chip.className}`}
                          >
                            {chip.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.room_number ? `Room ${c.room_number}` : 'No room'} · #{c.employee_no}
                          {c.card_no ? ` · Card ${c.card_no}` : ''}
                          {c.has_face ? ' · Face' : ''}
                          {c.has_fingerprint ? ' · Fingerprint' : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Valid {c.valid_from} → {c.valid_to}
                        </p>
                        {c.last_error ? (
                          <p className="mt-1 text-xs text-destructive">{c.last_error}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2" data-access-menu>
                        <div className="relative">
                          <button
                            type="button"
                            className="app-btn app-btn-primary h-11 min-w-[7.5rem] text-sm"
                            disabled={pending || !enrollmentStation}
                            title={
                              enrollmentStation
                                ? 'Enroll at the station'
                                : `Save enrollment station first (${setupHint(viewerRole)})`
                            }
                            onClick={(e) => {
                              e.stopPropagation()
                              setMoreMenuId(null)
                              setEnrollMenuId((id) => (id === c.id ? null : c.id))
                            }}
                          >
                            Enroll
                            <ChevronDown className="ml-1 inline h-4 w-4" aria-hidden />
                          </button>
                          {enrollMenuId === c.id ? (
                            <div className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-xl border border-border bg-card p-1 shadow-lg">
                              {(
                                [
                                  ['card', 'Card'],
                                  ['face', `Face${c.has_face ? ' ✓' : ''}`],
                                  ['fingerprint', `Fingerprint${c.has_fingerprint ? ' ✓' : ''}`],
                                ] as const
                              ).map(([kind, label]) => (
                                <button
                                  key={kind}
                                  type="button"
                                  className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-muted/60"
                                  disabled={pending || !enrollmentStation}
                                  onClick={() => queueEnroll(c.id, kind)}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="relative">
                          <button
                            type="button"
                            className="app-btn app-btn-ghost h-11 w-11 px-0"
                            aria-label="More guest access actions"
                            disabled={pending}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEnrollMenuId(null)
                              setMoreMenuId((id) => (id === c.id ? null : c.id))
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {moreMenuId === c.id ? (
                            <div className="absolute right-0 z-20 mt-1 w-64 space-y-2 rounded-xl border border-border bg-card p-3 shadow-lg">
                              <div className="flex gap-2">
                                <input
                                  className="app-field h-9 flex-1 text-xs"
                                  placeholder={c.card_no ?? 'Card number'}
                                  value={cardDrafts[c.id] ?? ''}
                                  onChange={(e) =>
                                    setCardDrafts((prev) => ({
                                      ...prev,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="app-btn app-btn-secondary h-9 text-xs"
                                  disabled={pending || !(cardDrafts[c.id] ?? '').trim()}
                                  onClick={() => {
                                    setMoreMenuId(null)
                                    run(async () => {
                                      const result = await assignAccessCard({
                                        hotelId,
                                        credentialId: c.id,
                                        cardNo: cardDrafts[c.id] ?? '',
                                      })
                                      if (!result.success) setError(result.error)
                                      else {
                                        setMessage('Card assignment queued.')
                                        setCardDrafts((prev) => ({ ...prev, [c.id]: '' }))
                                      }
                                    })
                                  }}
                                >
                                  Assign
                                </button>
                              </div>
                              {needsRetry ? (
                                <button
                                  type="button"
                                  className="app-btn app-btn-secondary h-9 w-full text-xs"
                                  disabled={pending}
                                  onClick={() => {
                                    setMoreMenuId(null)
                                    run(async () => {
                                      const result = await retryAccessCredential(hotelId, c.id)
                                      if (!result.success) setError(result.error)
                                      else setMessage('Re-provision queued.')
                                    })
                                  }}
                                >
                                  Retry sync
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {showToday ? (
        <div className="surface-card overflow-hidden">
          <div className="surface-card-header space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ListTodo className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Job activity</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {canBulkManageJobs
                      ? 'What the agent is doing — failed and pending first.'
                      : 'Guest unlock and badge sync only. Staff jobs stay hidden.'}
                  </p>
                </div>
              </div>
              {canBulkManageJobs ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className="app-btn app-btn-ghost h-8 text-xs"
                    disabled={pending || openJobCount === 0}
                    onClick={() =>
                      run(async () => {
                        const result = await cancelOpenAccessJobsAction(hotelId)
                        if (!result.success) setError(result.error)
                        else setMessage(`Cancelled ${result.data?.count ?? 0} open job(s).`)
                      })
                    }
                  >
                    Cancel open
                  </button>
                  <button
                    type="button"
                    className="app-btn app-btn-ghost h-8 text-xs text-muted-foreground"
                    disabled={pending || jobs.length === 0}
                    onClick={() =>
                      run(async () => {
                        const result = await clearAccessJobsAction(hotelId)
                        if (!result.success) setError(result.error)
                        else setMessage(`Cleared ${result.data?.count ?? 0} job(s).`)
                      })
                    }
                  >
                    Clear list
                  </button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['open', `Open${openJobCount ? ` (${openJobCount})` : ''}`],
                  ['failed', 'Failed'],
                  ['pending', 'Pending'],
                  ['all', 'All'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`filter-pill filter-pill--sm access-touch-pill ${
                    jobFilter === id ? 'filter-pill--active' : ''
                  }`}
                  onClick={() => setJobFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="surface-card-body">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No jobs yet. Unlock or enroll to see activity here.
              </p>
            ) : filteredJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No jobs in this filter.{' '}
                <button
                  type="button"
                  className="min-h-11 font-medium text-foreground underline"
                  onClick={() => setJobFilter('all')}
                >
                  Show all
                </button>
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {filteredJobs.map((j) => {
                  const canCancel =
                    j.status === 'pending' || j.status === 'failed' || j.status === 'claimed'
                  return (
                    <li
                      key={j.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {j.job_type.replace(/_/g, ' ')}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${jobStatusChip(j.status)}`}
                          >
                            {j.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {j.attempts}/{j.max_attempts} attempts ·{' '}
                          {new Date(j.created_at).toLocaleString()}
                        </p>
                        {j.last_error ? (
                          <p className="mt-1 text-xs text-destructive">{j.last_error}</p>
                        ) : null}
                      </div>
                      {canCancel ? (
                        <button
                          type="button"
                          className="app-btn app-btn-ghost h-11 shrink-0 text-sm sm:self-center"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const result = await cancelAccessJobAction({
                                hotelId,
                                jobId: j.id,
                              })
                              if (!result.success) setError(result.error)
                              else setMessage('Job cancelled.')
                            })
                          }
                        >
                          Cancel
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <AccessFeedback error={error} message={message} />
    </div>
  )
}

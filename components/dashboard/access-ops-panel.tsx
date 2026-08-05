'use client'

import { useState, useTransition } from 'react'
import { DoorOpen } from 'lucide-react'
import {
  assignAccessCard,
  remoteUnlockDoor,
  retryAccessCredential,
  startEnrollmentCapture,
} from '@/app/actions/access-control'
import type {
  AccessCredentialRow,
  AccessDeviceRow,
  AccessPointRow,
  AccessJobRow,
} from '@/lib/access/types'

interface AccessOpsPanelProps {
  hotelId: string
  points: AccessPointRow[]
  credentials: AccessCredentialRow[]
  jobs: AccessJobRow[]
  devices?: AccessDeviceRow[]
}

export function AccessOpsPanel({
  hotelId,
  points,
  credentials,
  jobs,
  devices = [],
}: AccessOpsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({})

  const enrollmentStation = devices.find((d) => d.device_role === 'enrollment' && d.managed_in_cloud)

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

  return (
    <div className="space-y-6">
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />
        <div className="surface-card-header">
          <div className="flex items-center gap-3">
            <DoorOpen className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Remote unlock</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Queues an unlock for the on-site agent. Audited in activity log.
              </p>
            </div>
          </div>
        </div>
        <div className="surface-card-body">
          {points.filter((p) => p.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active doors mapped.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {points
                .filter((p) => p.is_active)
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <span className="text-sm text-foreground">{p.label}</span>
                    <button
                      type="button"
                      className="app-btn app-btn-secondary"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await remoteUnlockDoor({
                            hotelId,
                            accessPointId: p.id,
                          })
                          if (!result.success) setError(result.error)
                          else setMessage(`Unlock queued for ${p.label}.`)
                        })
                      }
                    >
                      Unlock
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h3 className="text-lg font-semibold text-foreground">Guest credentials</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Synced on check-in. Enroll at the DS-K1F600U-D6E-F station, or type a card number.
            {enrollmentStation ? (
              <>
                {' '}
                Station: <span className="font-medium text-foreground">{enrollmentStation.label}</span>
                {enrollmentStation.is_online ? ' (online)' : ''}.
              </>
            ) : (
              <> No enrollment station saved yet (Owner → Access).</>
            )}
          </p>
        </div>
        <div className="surface-card-body overflow-x-auto">
          {credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credentials yet.</p>
          ) : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Guest</th>
                  <th className="pb-2 pr-3 font-medium">Room</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Valid</th>
                  <th className="pb-2 font-medium">Credentials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {credentials.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-foreground">
                        {c.guest_name ?? c.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground">#{c.employee_no}</div>
                      {c.last_error && (
                        <div className="mt-1 text-xs text-destructive">{c.last_error}</div>
                      )}
                    </td>
                    <td className="py-3 pr-3">{c.room_number ?? '—'}</td>
                    <td className="py-3 pr-3">
                      <span className="text-xs">
                        {c.status} / {c.sync_status}
                      </span>
                      {(c.sync_status === 'failed' || c.status === 'error') && (
                        <button
                          type="button"
                          className="app-btn app-btn-ghost ml-2 text-xs"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const result = await retryAccessCredential(hotelId, c.id)
                              if (!result.success) setError(result.error)
                              else setMessage('Re-provision queued.')
                            })
                          }
                        >
                          Retry
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {c.valid_from} → {c.valid_to}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            className="app-field h-8 w-28 text-xs"
                            placeholder={c.card_no ?? 'Card no'}
                            value={cardDrafts[c.id] ?? ''}
                            onChange={(e) =>
                              setCardDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="app-btn app-btn-secondary h-8 text-xs"
                            disabled={pending || !(cardDrafts[c.id] ?? '').trim()}
                            onClick={() =>
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
                            }
                          >
                            Assign
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn-primary h-8 text-xs"
                            disabled={pending || !enrollmentStation}
                            title={
                              enrollmentStation
                                ? 'Tap card on DS-K1F600U-D6E-F'
                                : 'Save enrollment station first'
                            }
                            onClick={() =>
                              run(async () => {
                                const result = await startEnrollmentCapture({
                                  hotelId,
                                  credentialId: c.id,
                                  capture: 'card',
                                })
                                if (!result.success) setError(result.error)
                                else
                                  setMessage(
                                    'Waiting for card on DS-K1F600U-D6E-F — tap the card on the station.',
                                  )
                              })
                            }
                          >
                            Enroll card
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="app-btn app-btn-secondary h-8 text-xs"
                            disabled={pending || !enrollmentStation}
                            onClick={() =>
                              run(async () => {
                                const result = await startEnrollmentCapture({
                                  hotelId,
                                  credentialId: c.id,
                                  capture: 'face',
                                })
                                if (!result.success) setError(result.error)
                                else
                                  setMessage(
                                    'Face enroll queued — guest should face the DS-K1F600U-D6E-F.',
                                  )
                              })
                            }
                          >
                            Enroll face{c.has_face ? ' ✓' : ''}
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn-secondary h-8 text-xs"
                            disabled={pending || !enrollmentStation}
                            onClick={() =>
                              run(async () => {
                                const result = await startEnrollmentCapture({
                                  hotelId,
                                  credentialId: c.id,
                                  capture: 'fingerprint',
                                })
                                if (!result.success) setError(result.error)
                                else
                                  setMessage(
                                    'Fingerprint enroll queued — place finger on the DS-K1F600U-D6E-F.',
                                  )
                              })
                            }
                          >
                            Enroll fingerprint{c.has_fingerprint ? ' ✓' : ''}
                          </button>
                          {c.card_no ? (
                            <span className="text-xs text-muted-foreground">Card {c.card_no}</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h3 className="text-lg font-semibold text-foreground">Recent jobs</h3>
        </div>
        <div className="surface-card-body overflow-x-auto">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet.</p>
          ) : (
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Type</th>
                  <th className="pb-2 pr-3 font-medium">Status</th>
                  <th className="pb-2 pr-3 font-medium">Attempts</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="py-2 pr-3">{j.job_type}</td>
                    <td className="py-2 pr-3">
                      {j.status}
                      {j.last_error ? (
                        <span className="mt-0.5 block text-xs text-destructive">{j.last_error}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      {j.attempts}/{j.max_attempts}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(j.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
    </div>
  )
}

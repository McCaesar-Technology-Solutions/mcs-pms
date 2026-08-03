'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarSync, Copy, Check, RefreshCw } from 'lucide-react'
import {
  upsertAirbnbImportFeed,
  syncAirbnbFeedNow,
  setAirbnbFeedActive,
  deleteAirbnbFeed,
} from '@/app/actions/channel-ical'
import type { ChannelIcalFeedView } from '@/lib/data/channel-ical'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'

interface RoomOption {
  id: string
  number: string
}

interface AirbnbSyncPanelProps {
  hotelId: string
  propertyName: string
  rooms: RoomOption[]
  feeds: ChannelIcalFeedView[]
}

function statusBadge(status: ChannelIcalFeedView['lastSyncStatus']) {
  if (status === 'ok') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
  }
  if (status === 'error') {
    return 'bg-destructive/15 text-destructive'
  }
  if (status === 'pending') {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
  }
  return 'bg-muted text-muted-foreground'
}

export function AirbnbSyncPanel({
  hotelId,
  propertyName,
  rooms,
  feeds,
}: AirbnbSyncPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [importUrl, setImportUrl] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const importFeeds = useMemo(
    () => feeds.filter((f) => f.direction === 'import' && f.provider === 'airbnb'),
    [feeds],
  )
  const exportByRoom = useMemo(() => {
    const map = new Map<string, ChannelIcalFeedView>()
    for (const f of feeds) {
      if (f.direction === 'export' && f.provider === 'airbnb') map.set(f.roomId, f)
    }
    return map
  }, [feeds])

  const connectedRoomIds = useMemo(
    () => new Set(importFeeds.filter((f) => f.isActive).map((f) => f.roomId)),
    [importFeeds],
  )

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

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex items-center gap-3">
          <CalendarSync className="h-6 w-6 shrink-0 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">Airbnb calendar sync</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pull Airbnb bookings into {propertyName} and push MOJO dates back to Airbnb.
            </p>
          </div>
        </div>
      </div>

      <div className="surface-card-body space-y-8">
        <section className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">How to connect</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                In Airbnb: listing → <span className="text-foreground">Availability</span> →{' '}
                <span className="text-foreground">Connect calendars</span> → Export calendar → copy
                the link.
              </li>
              <li>Paste that link below for the matching apartment/room.</li>
              <li>
                Copy the MOJO export URL and add it in Airbnb under{' '}
                <span className="text-foreground">Import calendar</span>.
              </li>
            </ol>
          </div>
        </section>

        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add rooms first, then connect Airbnb.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const result = await upsertAirbnbImportFeed({
                  hotelId,
                  roomId,
                  importUrl: importUrl.trim(),
                })
                if (!result.success) {
                  setError(result.error)
                  return
                }
                setImportUrl('')
                setMessage(result.message ?? 'Connected.')
              })
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Room / apartment" required>
                <select
                  className={APP_FIELD_CLASS}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.number}
                      {connectedRoomIds.has(r.id) ? ' (connected)' : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                label="Airbnb export calendar URL"
                required
                hint="HTTPS link from Airbnb → Export calendar"
              >
                <input
                  className={APP_FIELD_CLASS}
                  type="url"
                  inputMode="url"
                  placeholder="https://www.airbnb.com/calendar/ical/…"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  required
                />
              </FormField>
            </div>
            <button type="submit" disabled={pending || !roomId} className="app-btn app-btn-primary">
              {pending ? 'Saving…' : 'Connect Airbnb calendar'}
            </button>
          </form>
        )}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
            {message}
          </p>
        )}

        <section className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Connected rooms</p>
          {importFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Airbnb calendars connected yet.</p>
          ) : (
            <ul className="space-y-3">
              {importFeeds.map((feed) => {
                const exportFeed = exportByRoom.get(feed.roomId)
                return (
                  <li key={feed.id} className="surface-inset rounded-xl p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          Room {feed.roomNumber}
                          <span className="ml-2 font-normal text-muted-foreground">{feed.name}</span>
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(feed.lastSyncStatus)}`}
                          >
                            {feed.isActive ? feed.lastSyncStatus ?? 'idle' : 'paused'}
                          </span>
                          {feed.lastSyncAt && (
                            <span className="text-xs text-muted-foreground">
                              Last sync {new Date(feed.lastSyncAt).toLocaleString()}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {feed.eventsSynced} event{feed.eventsSynced === 1 ? '' : 's'}
                          </span>
                        </div>
                        {feed.lastSyncMessage && (
                          <p className="mt-1 text-xs text-muted-foreground">{feed.lastSyncMessage}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending || !feed.isActive}
                          className="app-btn app-btn-secondary inline-flex items-center gap-1.5"
                          onClick={() =>
                            run(async () => {
                              const result = await syncAirbnbFeedNow({
                                feedId: feed.id,
                                hotelId,
                              })
                              if (!result.success) {
                                setError(result.error)
                                return
                              }
                              setMessage(result.message ?? 'Synced.')
                            })
                          }
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync now
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="app-btn app-btn-secondary"
                          onClick={() =>
                            run(async () => {
                              const result = await setAirbnbFeedActive({
                                feedId: feed.id,
                                hotelId,
                                active: !feed.isActive,
                              })
                              if (!result.success) {
                                setError(result.error)
                                return
                              }
                              setMessage(result.message ?? 'Updated.')
                            })
                          }
                        >
                          {feed.isActive ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="app-btn app-btn-secondary text-destructive"
                          onClick={() =>
                            run(async () => {
                              const result = await deleteAirbnbFeed({
                                feedId: feed.id,
                                hotelId,
                              })
                              if (!result.success) {
                                setError(result.error)
                                return
                              }
                              setMessage(result.message ?? 'Disconnected.')
                            })
                          }
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>

                    {exportFeed && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="text-xs font-medium text-foreground">
                          MOJO export URL (paste into Airbnb Import calendar)
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <code className="block max-w-full truncate rounded-lg bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                            {exportFeed.exportUrl}
                          </code>
                          <button
                            type="button"
                            className="app-btn app-btn-secondary inline-flex items-center gap-1.5"
                            onClick={() => copyText(feed.id, exportFeed.exportUrl)}
                          >
                            {copiedId === feed.id ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Automatic sync runs about every 5 minutes. Airbnb iCal does not include guest phone or
          full payment detail — staff still check guests in as usual. Use Channel prepaid when Airbnb
          already paid you.
        </p>
      </div>
    </div>
  )
}

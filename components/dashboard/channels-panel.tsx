'use client'

import { useState, useTransition } from 'react'
import { Copy, RefreshCw, Trash2, Link2, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  createImportFeed,
  deleteChannelFeed,
  regenerateExportToken,
  setChannelFeedActive,
  syncChannelFeedNow,
} from '@/app/actions/channels'
import { PROVIDER_LABEL, type ChannelFeedView } from '@/lib/channels/labels'
import type { ChannelProvider } from '@/types'

interface ChannelsPanelProps {
  importFeeds: ChannelFeedView[]
  exportFeeds: ChannelFeedView[]
  rooms: { id: string; number: string }[]
}

export function ChannelsPanel({ importFeeds, exportFeeds, rooms }: ChannelsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<ChannelProvider>('airbnb')
  const [importUrl, setImportUrl] = useState('')
  const [roomId, setRoomId] = useState('')

  function copyUrl(feedId: string, url: string) {
    void navigator.clipboard.writeText(url)
    setCopiedId(feedId)
    toast.success('Calendar URL copied')
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createImportFeed({ name, provider, importUrl, roomId })
      if (result.success) {
        toast.success('Import feed added')
        setName('')
        setImportUrl('')
        setRoomId('')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleSync(feedId: string) {
    startTransition(async () => {
      const result = await syncChannelFeedNow(feedId)
      if (result.success) toast.success('Calendar synced')
      else toast.error(result.error)
    })
  }

  function handleDelete(feedId: string) {
    if (!confirm('Remove this calendar feed? Imported reservations stay in the system.')) return
    startTransition(async () => {
      const result = await deleteChannelFeed(feedId)
      if (result.success) toast.success('Feed removed')
      else toast.error(result.error)
    })
  }

  function handleToggle(feedId: string, active: boolean) {
    startTransition(async () => {
      const result = await setChannelFeedActive(feedId, active)
      if (!result.success) toast.error(result.error)
    })
  }

  function handleRegenerate(feedId: string) {
    if (!confirm('Regenerate export URL? Update Airbnb/Booking.com with the new link.')) return
    startTransition(async () => {
      const result = await regenerateExportToken(feedId)
      if (result.success) toast.success('Export URL regenerated')
      else toast.error(result.error)
    })
  }

  return (
    <div className="space-y-8">
      <section className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h2 className="text-lg font-semibold">Import calendars</h2>
          <p className="text-sm text-muted-foreground">
            Paste your Airbnb or Booking.com iCal export URL. We pull bookings every 15 minutes and
            create reservations automatically.
          </p>
        </div>

        <form onSubmit={handleCreate} className="grid gap-4 border-b border-[#E9ECEF] p-6 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Feed name</span>
            <input
              className="input-field w-full"
              placeholder="Airbnb — Room 101"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Channel</span>
            <select
              className="input-field w-full"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ChannelProvider)}
            >
              <option value="airbnb">Airbnb</option>
              <option value="booking_com">Booking.com</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-1.5 lg:col-span-2">
            <span className="text-sm font-semibold">iCal URL</span>
            <input
              className="input-field w-full"
              type="url"
              placeholder="https://…"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              required
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-semibold">Room (optional)</span>
            <select
              className="input-field w-full"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Unassigned — assign at front desk</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.number}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-primary gap-2" disabled={pending}>
              <Plus className="h-4 w-4" />
              Add import feed
            </button>
          </div>
        </form>

        {importFeeds.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No import feeds yet. Add your OTA calendar URL above.
          </p>
        ) : (
          <div className="divide-y divide-[#E9ECEF]">
            {importFeeds.map((feed) => (
              <FeedRow
                key={feed.id}
                feed={feed}
                pending={pending}
                onSync={() => handleSync(feed.id)}
                onDelete={() => handleDelete(feed.id)}
                onToggle={(active) => handleToggle(feed.id, active)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h2 className="text-lg font-semibold">Export calendars</h2>
          <p className="text-sm text-muted-foreground">
            Subscribe to these URLs in Airbnb or Booking.com to block dates when you have direct
            bookings in MOJO.
          </p>
        </div>

        {exportFeeds.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            Add rooms to your property to generate export feeds.
          </p>
        ) : (
          <div className="divide-y divide-[#E9ECEF]">
            {exportFeeds.map((feed) => (
              <div key={feed.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{feed.name}</p>
                  {feed.roomNumber && (
                    <p className="text-xs text-muted-foreground">Room {feed.roomNumber}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {feed.exportUrl && (
                    <button
                      type="button"
                      className="btn-secondary gap-2 text-sm"
                      onClick={() => copyUrl(feed.id, feed.exportUrl!)}
                      disabled={pending}
                    >
                      {copiedId === feed.id ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      Copy URL
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary gap-2 text-sm"
                    onClick={() => handleRegenerate(feed.id)}
                    disabled={pending}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FeedRow({
  feed,
  pending,
  onSync,
  onDelete,
  onToggle,
}: {
  feed: ChannelFeedView
  pending: boolean
  onSync: () => void
  onDelete: () => void
  onToggle: (active: boolean) => void
}) {
  const statusTone =
    feed.lastSyncStatus === 'ok'
      ? 'text-emerald-600'
      : feed.lastSyncStatus === 'error'
        ? 'text-red-600'
        : 'text-muted-foreground'

  return (
    <div className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{feed.name}</p>
          <span className="rounded-full bg-[#F4F0FF] px-2 py-0.5 text-xs font-medium text-[#2D215B]">
            {PROVIDER_LABEL[feed.provider]}
          </span>
          {feed.roomNumber && (
            <span className="text-xs text-muted-foreground">Room {feed.roomNumber}</span>
          )}
        </div>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <Link2 className="h-3 w-3 shrink-0" />
          {feed.importUrl}
        </p>
        <p className={`text-xs ${statusTone}`}>
          {feed.lastSyncAt
            ? `Last sync ${new Date(feed.lastSyncAt).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })} — ${feed.lastSyncMessage ?? feed.lastSyncStatus ?? 'pending'}`
            : 'Not synced yet'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={feed.isActive}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={pending}
          />
          Active
        </label>
        <button type="button" className="btn-secondary gap-2 text-sm" onClick={onSync} disabled={pending}>
          <RefreshCw className="h-4 w-4" />
          Sync now
        </button>
        <button
          type="button"
          className="btn-secondary gap-2 text-sm text-red-600"
          onClick={onDelete}
          disabled={pending}
        >
          <Trash2 className="h-4 w-4" />
          Remove
        </button>
      </div>
    </div>
  )
}

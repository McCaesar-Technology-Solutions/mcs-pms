'use client'

import { useState, useTransition } from 'react'
import { Globe, Trash2 } from 'lucide-react'
import {
  deleteWebsiteListingMap,
  upsertWebsiteListingMap,
} from '@/app/actions/website-listing-maps'
import type { WebsiteListingMapView } from '@/lib/data/website-listing-maps'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'

interface RoomOption {
  id: string
  number: string
}

interface WebsiteListingMapsPanelProps {
  hotelId: string
  rooms: RoomOption[]
  maps: WebsiteListingMapView[]
}

export function WebsiteListingMapsPanel({ hotelId, rooms, maps }: WebsiteListingMapsPanelProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [slug, setSlug] = useState('')
  const [roomId, setRoomId] = useState('')

  function run(action: () => Promise<{ success: boolean; error?: string }>, okMessage: string) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        setError(result.error ?? 'Could not save.')
        return
      }
      setMessage(okMessage)
      setPropertyId('')
      setSlug('')
      setRoomId('')
    })
  }

  return (
    <section className="surface-card rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Website listings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Map a public Request-to-Book listing (property UUID from the website admin) to this
            hotel. Leave room blank to assign any free room when the guest requests.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label="Website property UUID">
          <input
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className={APP_FIELD_CLASS}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            spellCheck={false}
          />
        </FormField>
        <FormField label="Slug (optional)">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={APP_FIELD_CLASS}
            placeholder="osu-one-bed"
          />
        </FormField>
        <FormField label="Room (optional)">
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className={APP_FIELD_CLASS}
          >
            <option value="">Any available room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                Room {room.number}
              </option>
            ))}
          </select>
        </FormField>
        <div className="flex items-end">
          <button
            type="button"
            disabled={pending || !propertyId}
            onClick={() =>
              run(
                () =>
                  upsertWebsiteListingMap({
                    hotelId,
                    websitePropertyId: propertyId.trim(),
                    websiteSlug: slug,
                    roomId,
                  }),
                'Listing mapped. Website requests will appear as provisional stays.',
              )
            }
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save mapping'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}

      {maps.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No website listings linked yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {maps.map((map) => (
            <li
              key={map.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground">
                  {map.websitePropertyId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {map.websiteSlug ? `/${map.websiteSlug}` : 'no slug'}
                  {' · '}
                  {map.roomNumber ? `Room ${map.roomNumber}` : 'any free room'}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteWebsiteListingMap({ hotelId, mapId: map.id }),
                    'Mapping removed.',
                  )
                }
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                aria-label="Remove listing map"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

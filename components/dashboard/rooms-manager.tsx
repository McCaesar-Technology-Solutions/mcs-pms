'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createRoom, deleteRoom, updateRoom, updateRoomStatus } from '@/app/actions/rooms'
import { RoomCategoriesPanel } from '@/components/dashboard/room-categories-panel'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type { DbRoom, DbRoomStatus, RoomCategory } from '@/types'

const STATUS_CONFIG: Record<DbRoomStatus, { label: string; dot: string; chip: string }> = {
  available: { label: 'Available', dot: 'bg-[#D4A62E]', chip: 'bg-[#D4A62E]/15 text-[#B88D24]' },
  occupied: { label: 'Occupied', dot: 'bg-[#3C216C]', chip: 'bg-[#3C216C] text-white' },
  cleaning: { label: 'Cleaning', dot: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700' },
  needs_inspection: {
    label: 'Needs inspection',
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800',
  },
  maintenance: { label: 'Maintenance', dot: 'bg-red-500', chip: 'bg-red-100 text-red-700' },
}

const STATUS_ORDER: DbRoomStatus[] = [
  'available',
  'occupied',
  'cleaning',
  'needs_inspection',
  'maintenance',
]

const tileColor: Record<DbRoomStatus, string> = {
  available: 'bg-[#D4A62E]/15 text-[#B88D24] ring-[#D4A62E]/25',
  occupied: 'bg-[#3C216C] text-white ring-[#3C216C]/30',
  cleaning: 'bg-orange-100 text-orange-700 ring-orange-200',
  needs_inspection: 'bg-amber-100 text-amber-800 ring-amber-200',
  maintenance: 'bg-red-100 text-red-700 ring-red-200',
}

function categoryLabel(room: DbRoom): string {
  return room.room_categories?.name ?? 'Uncategorized'
}

interface RoomsManagerProps {
  rooms: DbRoom[]
  categories: RoomCategory[]
  canDelete?: boolean
  /** Front-desk mode: change room status only, no add/edit/delete or pricing. */
  statusOnly?: boolean
  initialSearch?: string
}

export function RoomsManager({
  rooms,
  categories,
  canDelete = false,
  statusOnly = false,
  initialSearch = '',
}: RoomsManagerProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<DbRoom | null>(null)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialSearch)

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter(
      (r) =>
        r.number.toLowerCase().includes(q) ||
        categoryLabel(r).toLowerCase().includes(q) ||
        String(r.floor ?? '').includes(q),
    )
  }, [rooms, searchQuery])

  const counts = useMemo(() => {
    const map: Record<DbRoomStatus, number> = {
      available: 0,
      occupied: 0,
      cleaning: 0,
      needs_inspection: 0,
      maintenance: 0,
    }
    for (const room of filteredRooms) {
      const status = (room.status ?? 'available') as DbRoomStatus
      map[status] = (map[status] ?? 0) + 1
    }
    return map
  }, [filteredRooms])

  const canAddRoom = categories.length > 0

  return (
    <div className="space-y-6">
      {!statusOnly && <RoomCategoriesPanel categories={categories} />}

      <div className="surface-card p-6">
        <div className="surface-card-accent" />
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Room Status</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredRooms.length} of {rooms.length} rooms · tap a room to update
            </p>
          </div>
          {!statusOnly && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={!canAddRoom}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add room
            </button>
          )}
        </div>

        <div className="relative mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search room number, category, floor…"
            className="w-full max-w-md rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {!statusOnly && !canAddRoom && (
          <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Add at least one room category before creating rooms.
          </p>
        )}

        {rooms.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No rooms yet. Add your first room to get started.
          </p>
        ) : filteredRooms.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No rooms match your search.</p>
        ) : (
          <div className="relative grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {filteredRooms.map((room) => {
              const status = (room.status ?? 'available') as DbRoomStatus
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setEditing(room)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold ring-1 transition-transform hover:scale-105 ${tileColor[status]}`}
                  title={`Room ${room.number} — ${STATUS_CONFIG[status].label}`}
                >
                  {room.number}
                  <span className="mt-0.5 max-w-full truncate px-1 text-[9px] font-medium opacity-80">
                    {categoryLabel(room)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded ${STATUS_CONFIG[status].dot}`} />
              <span className="text-sm text-muted-foreground">{STATUS_CONFIG[status].label}</span>
              <span className="text-sm font-semibold text-foreground">({counts[status]})</span>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <RoomModal
          room={editing}
          categories={categories}
          canDelete={canDelete}
          statusOnly={statusOnly}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      {creating && (
        <RoomModal
          categories={categories}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

interface RoomModalProps {
  room?: DbRoom
  categories: RoomCategory[]
  canDelete?: boolean
  statusOnly?: boolean
  onClose: () => void
  onDone: () => void
}

function RoomModal({ room, categories, canDelete, statusOnly = false, onClose, onDone }: RoomModalProps) {
  const isEdit = Boolean(room)
  const defaultCategoryId = room?.category_id ?? categories[0]?.id ?? ''
  const [number, setNumber] = useState(room?.number ?? '')
  const [floor, setFloor] = useState(String(room?.floor ?? 1))
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [nightlyRate, setNightlyRate] = useState(
    String(room?.nightly_rate ?? categories.find((c) => c.id === defaultCategoryId)?.default_nightly_rate ?? ''),
  )
  const [status, setStatus] = useState<DbRoomStatus>((room?.status ?? 'available') as DbRoomStatus)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (isEdit) return
    const category = categories.find((c) => c.id === categoryId)
    if (category) {
      setNightlyRate(String(category.default_nightly_rate))
    }
  }, [categoryId, categories, isEdit])

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
    const category = categories.find((c) => c.id === nextCategoryId)
    if (category) {
      setNightlyRate(String(category.default_nightly_rate))
    }
  }

  function save() {
    setError(null)
    startTransition(async () => {
      if (statusOnly && isEdit) {
        const result = await updateRoomStatus(room!.id, status)
        if (result.success) onDone()
        else setError(result.error)
        return
      }
      const payload = {
        number,
        floor: Number(floor),
        categoryId,
        nightlyRate: Number(nightlyRate),
      }
      const result = isEdit
        ? await updateRoom(room!.id, { ...payload, status })
        : await createRoom(payload)
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await deleteRoom(room!.id)
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label={isEdit ? 'Edit room' : 'Add room'}>
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">
          {isEdit ? `Room ${room!.number}` : 'Add room'}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {statusOnly
            ? 'Update the room status.'
            : isEdit
              ? 'Update room details and status.'
              : 'Create a new room for this property.'}
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {!statusOnly && (
          <>
            <Field label="Room number">
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="e.g. 204"
                className={fieldClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Floor">
                <input
                  type="number"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  min={0}
                  className={fieldClass}
                />
              </Field>
              <Field label="Category">
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={fieldClass}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Nightly rate (₵)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={nightlyRate}
                onChange={(e) => setNightlyRate(e.target.value)}
                className={fieldClass}
              />
            </Field>
          </>
        )}

        {isEdit && (
          <Field label="Status">
            <div className="grid grid-cols-2 gap-2">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    status === s
                      ? 'shadow-elevation-2 ring-2 ring-[#3C216C]/20 ' + STATUS_CONFIG[s].chip
                      : 'bg-white text-foreground shadow-elevation-1 hover:shadow-elevation-2'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between gap-3">
        {isEdit && canDelete ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add room'}
          </button>
        </div>
      </ModalFooter>
    </CenteredModal>
  )
}

const fieldClass =
  'w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 text-sm text-foreground shadow-elevation-1 outline-none transition-[box-shadow] focus:shadow-elevation-2 focus:ring-2 focus:ring-[#3C216C]/10'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

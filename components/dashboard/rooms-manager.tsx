'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createRoom, deleteRoom, updateRoom } from '@/app/actions/rooms'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type { DbRoom, DbRoomStatus, DbRoomType } from '@/types'

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

const TYPE_LABELS: Record<DbRoomType, string> = {
  standard: 'Standard',
  deluxe: 'Deluxe',
  suite: 'Suite',
}

const tileColor: Record<DbRoomStatus, string> = {
  available: 'bg-[#D4A62E]/15 text-[#B88D24] ring-[#D4A62E]/25',
  occupied: 'bg-[#3C216C] text-white ring-[#3C216C]/30',
  cleaning: 'bg-orange-100 text-orange-700 ring-orange-200',
  needs_inspection: 'bg-amber-100 text-amber-800 ring-amber-200',
  maintenance: 'bg-red-100 text-red-700 ring-red-200',
}

interface RoomsManagerProps {
  rooms: DbRoom[]
  canDelete?: boolean
}

export function RoomsManager({ rooms, canDelete = false }: RoomsManagerProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<DbRoom | null>(null)
  const [creating, setCreating] = useState(false)

  const counts = useMemo(() => {
    const map: Record<DbRoomStatus, number> = {
      available: 0,
      occupied: 0,
      cleaning: 0,
      needs_inspection: 0,
      maintenance: 0,
    }
    for (const room of rooms) {
      const status = (room.status ?? 'available') as DbRoomStatus
      map[status] = (map[status] ?? 0) + 1
    }
    return map
  }, [rooms])

  return (
    <div className="space-y-6">
      <div className="surface-card p-6">
        <div className="surface-card-accent" />
        <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Room Status</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {rooms.length} rooms · tap a room to update
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2"
          >
            <Plus className="h-4 w-4" />
            Add room
          </button>
        </div>

        {rooms.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No rooms yet. Add your first room to get started.
          </p>
        ) : (
          <div className="relative grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {rooms.map((room) => {
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
                  <span className="mt-0.5 text-[9px] font-medium opacity-80">
                    {TYPE_LABELS[(room.type ?? 'standard') as DbRoomType]}
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
          canDelete={canDelete}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}

      {creating && (
        <RoomModal
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
  canDelete?: boolean
  onClose: () => void
  onDone: () => void
}

function RoomModal({ room, canDelete, onClose, onDone }: RoomModalProps) {
  const isEdit = Boolean(room)
  const [number, setNumber] = useState(room?.number ?? '')
  const [floor, setFloor] = useState(String(room?.floor ?? 1))
  const [type, setType] = useState<DbRoomType>((room?.type ?? 'standard') as DbRoomType)
  const [status, setStatus] = useState<DbRoomStatus>((room?.status ?? 'available') as DbRoomStatus)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updateRoom(room!.id, { number, floor: Number(floor), type, status })
        : await createRoom({ number, floor: Number(floor), type })
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
          {isEdit ? 'Update room details and status.' : 'Create a new room for this property.'}
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
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
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DbRoomType)}
              className={fieldClass}
            >
              {(Object.keys(TYPE_LABELS) as DbRoomType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

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

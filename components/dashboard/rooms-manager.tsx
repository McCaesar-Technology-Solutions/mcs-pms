'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Copy, Download, LayoutGrid, Layers, Plus, Trash2 } from 'lucide-react'
import { FloorRoomBoard } from '@/components/dashboard/floor-room-board'
import { OpsDateSelector } from '@/components/dashboard/ops-date-selector'
import type { RoomBoardSignal, StaffRoutePrefix } from '@/lib/data/front-desk-ops'
import { toast } from 'sonner'
import { createRoom, deleteRoom, updateRoom, updateRoomStatus } from '@/app/actions/rooms'
import { RoomCategoriesPanel } from '@/components/dashboard/room-categories-panel'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard } from '@/lib/export/entity-refs'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import { RoomProfilePhotoUpload } from '@/components/dashboard/room-profile-photo-upload'
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
  routePrefix: StaffRoutePrefix
  opsDate: string
  initialView?: 'grid' | 'floor'
  filter?: 'dirty' | 'maintenance' | 'all'
  roomSignals?: Record<string, RoomBoardSignal>
  openRoomId?: string
}

export function RoomsManager({
  rooms,
  categories,
  canDelete = false,
  statusOnly = false,
  initialSearch = '',
  routePrefix,
  opsDate,
  initialView = 'grid',
  filter = 'all',
  roomSignals = {},
  openRoomId,
}: RoomsManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const view: 'grid' | 'floor' =
    viewParam === 'floor' ? 'floor' : viewParam === 'grid' ? 'grid' : initialView
  const [editing, setEditing] = useState<DbRoom | null>(null)
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState(initialSearch)

  useEffect(() => {
    setSearchQuery(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    if (!openRoomId) return
    const room = rooms.find((r) => r.id === openRoomId)
    if (room) setEditing(room)
  }, [openRoomId, rooms])

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

  const selection = useRowSelection(filteredRooms, filteredRooms)

  const signalsMap = useMemo(() => new Map(Object.entries(roomSignals)), [roomSignals])

  const setView = useCallback(
    (next: 'grid' | 'floor') => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === 'floor') params.set('view', 'floor')
      else params.delete('view')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  function roomRef(room: DbRoom) {
    return `RM-${room.number}`
  }

  function copyRoomRefs() {
    void copyToClipboard(
      selection.selected.map(roomRef).join(', '),
      `Copied ${selection.selected.length} room ref${selection.selected.length === 1 ? '' : 's'}`,
    )
  }

  function exportRoomsCsv() {
    const header = ['Reference', 'Number', 'Category', 'Floor', 'Status', 'Nightly rate', 'Monthly rate']
    const csvRows = selection.selected.map((room) => [
      roomRef(room),
      room.number,
      categoryLabel(room),
      String(room.floor ?? ''),
      room.status ?? 'available',
      String(room.nightly_rate ?? ''),
      String(room.monthly_rate ?? ''),
    ])
    downloadCsv(`rooms-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...csvRows])
    toast.success(`Exported ${selection.selected.length} room${selection.selected.length === 1 ? '' : 's'}`)
  }

  const canAddRoom = categories.length > 0

  return (
    <div className="space-y-6">
      <BulkActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        ariaLabel="Bulk room actions"
        actions={[
          { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyRoomRefs },
          { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportRoomsCsv },
        ]}
      />
      {!statusOnly && <RoomCategoriesPanel categories={categories} />}

      <div className="surface-card p-6">
        <div className="surface-card-accent" />
        <div className="relative mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">Room Status</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredRooms.length} of {rooms.length} rooms ·{' '}
              {view === 'floor' ? 'floor board with live signals' : 'tap a room to update'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rooms-view-toggle" role="tablist" aria-label="Room view">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'grid'}
                className={`rooms-view-toggle__btn ${view === 'grid' ? 'rooms-view-toggle__btn--active' : ''}`}
                onClick={() => setView('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'floor'}
                className={`rooms-view-toggle__btn ${view === 'floor' ? 'rooms-view-toggle__btn--active' : ''}`}
                onClick={() => setView('floor')}
              >
                <Layers className="h-4 w-4" />
                Floors
              </button>
            </div>
            <OpsDateSelector opsDate={opsDate} />
            {!statusOnly && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                disabled={!canAddRoom}
                className="app-btn app-btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add room
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-4">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search room number, category, floor…"
            className="app-field max-w-md"
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
        ) : view === 'floor' ? (
          <FloorRoomBoard
            rooms={filteredRooms}
            signals={signalsMap}
            routePrefix={routePrefix}
            filter={filter}
            onRoomClick={(room) => setEditing(room)}
            selectedRoomIds={selection.selectedIds}
            categoryLabel={categoryLabel}
          />
        ) : (
          <div className="relative grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {filteredRooms.map((room) => {
              const status = (room.status ?? 'available') as DbRoomStatus
              const selected = selection.isSelected(room.id)
              return (
                <div key={room.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setEditing(room)}
                    className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl text-sm font-bold ring-1 transition-transform hover:scale-105 ${tileColor[status]} ${
                      selected ? 'ring-2 ring-primary/40 ring-offset-1' : ''
                    }`}
                    title={`Room ${room.number} — ${STATUS_CONFIG[status].label}`}
                  >
                    {room.number}
                    <span className="mt-0.5 max-w-full truncate px-1 text-[9px] font-medium opacity-80">
                      {categoryLabel(room)}
                    </span>
                  </button>
                  <BulkSelectCheckbox
                    checked={selected}
                    onChange={() => selection.toggle(room.id)}
                    aria-label={`Select room ${room.number}`}
                    className="absolute left-1.5 top-1.5 h-3.5 w-3.5 rounded bg-white/90 shadow-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
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
  const [monthlyRate, setMonthlyRate] = useState(
    String(
      room?.monthly_rate ??
        categories.find((c) => c.id === defaultCategoryId)?.default_monthly_rate ??
        '',
    ),
  )
  const [status, setStatus] = useState<DbRoomStatus>((room?.status ?? 'available') as DbRoomStatus)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (isEdit) return
    const category = categories.find((c) => c.id === categoryId)
    if (category) {
      setNightlyRate(String(category.default_nightly_rate))
      setMonthlyRate(
        category.default_monthly_rate != null ? String(category.default_monthly_rate) : '',
      )
    }
  }, [categoryId, categories, isEdit])

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
    const category = categories.find((c) => c.id === nextCategoryId)
    if (category) {
      setNightlyRate(String(category.default_nightly_rate))
      setMonthlyRate(
        category.default_monthly_rate != null ? String(category.default_monthly_rate) : '',
      )
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
      const monthlyRateValue: number | '' =
        monthlyRate.trim() === '' ? '' : Number(monthlyRate)
      const payload = {
        number,
        floor: Number(floor),
        categoryId,
        nightlyRate: Number(nightlyRate),
        monthlyRate: monthlyRateValue,
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
        {isEdit && !statusOnly && (
          <RoomProfilePhotoUpload
            roomId={room!.id}
            imagePath={room!.profile_image_path}
            roomNumber={room!.number}
            canEdit
          />
        )}

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

            <Field label="Monthly rate (₵, optional)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={monthlyRate}
                onChange={(e) => setMonthlyRate(e.target.value)}
                placeholder="Prorated ÷ 30 per night"
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

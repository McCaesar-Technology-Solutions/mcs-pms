'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import {
  Search,
  Mail,
  Phone,
  BedDouble,
  CalendarDays,
  Copy,
  Check,
  MessageCircle,
  Link2,
  RefreshCw,
  Ban,
  KeyRound,
  LogOut,
} from 'lucide-react'
import { CenteredModal, ModalBody, ModalHeader } from '@/components/ui/centered-modal'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import { regenerateGuestAccess, revokeGuestAccess, checkOutGuest, updateGuest } from '@/app/actions/guest'
import { GuestFolioPanel } from '@/components/dashboard/guest-folio-panel'
import { GuestsBulkBar } from '@/components/dashboard/guests-bulk-bar'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { hasPhoneNumber } from '@/lib/phone'
import { usePagination } from '@/lib/hooks/use-pagination'
import { toast } from 'sonner'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { PaymentMethod } from '@/types'
import { sortGuestDirectory, type GuestRow, type GuestStatus } from '@/lib/guests/guest-directory'
import type { ReservationChannel } from '@/types'

interface GuestsTableProps {
  guests: GuestRow[]
  initialSearch?: string
  openGuestId?: string
  readOnly?: boolean
}

const STATUS_LABEL: Record<GuestStatus, string> = {
  active: 'Active',
  returning: 'Returning',
  vip: 'VIP',
  new: 'New',
}

const SOURCE_LABEL: Record<ReservationChannel, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  direct: 'Direct',
  walk_in: 'Walk-in',
  other: 'Other',
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

function getStatusColor(status: GuestStatus) {
  switch (status) {
    case 'vip':
      return 'bg-[#3C216C] text-white'
    case 'returning':
      return 'bg-blue-600 text-blue-50'
    case 'active':
      return 'bg-amber-600 text-amber-50'
    default:
      return 'bg-gray-500 text-gray-50'
  }
}

function getSourceColor(source: ReservationChannel) {
  switch (source) {
    case 'direct':
      return 'bg-blue-100 text-blue-700'
    case 'airbnb':
      return 'bg-orange-100 text-orange-700'
    case 'booking_com':
      return 'bg-yellow-100 text-yellow-700'
    case 'walk_in':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

export function GuestsTable({
  guests,
  initialSearch = '',
  openGuestId,
  readOnly = false,
}: GuestsTableProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [selectedStatus, setSelectedStatus] = useState<GuestStatus | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null)

  useEffect(() => {
    setSearchQuery(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    if (!openGuestId) return
    const guest = guests.find((g) => g.id === openGuestId)
    if (guest) setSelectedGuest(guest)
  }, [openGuestId, guests])
  const [editingGuest, setEditingGuest] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const filteredGuests = useMemo(() => {
    const filtered = guests.filter((guest) => {
      const matchesSearch =
        guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (guest.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (guest.phone ?? '').includes(searchQuery)
      const matchesStatus = !selectedStatus || guest.status === selectedStatus
      return matchesSearch && matchesStatus
    })
    return sortGuestDirectory(filtered)
  }, [guests, searchQuery, selectedStatus])

  const bulkSelected = useMemo(
    () => guests.filter((g) => selectedIds.has(g.id)),
    [guests, selectedIds],
  )

  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((g) => selectedIds.has(g.id))

  const pagination = usePagination(
    filteredGuests,
    10,
    `${searchQuery}|${selectedStatus ?? ''}`,
  )

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredGuests.forEach((g) => next.delete(g.id))
      } else {
        filteredGuests.forEach((g) => next.add(g.id))
      }
      return next
    })
  }

  return (
    <>
      <GuestsBulkBar selected={bulkSelected} onClear={() => setSelectedIds(new Set())} />
      <div className="surface-card">
        <div className="surface-card-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Guest Directory</h2>
            <p className="text-sm text-muted-foreground mt-1">{filteredGuests.length} guests</p>
          </div>
        </div>

        <div className="surface-card-header space-y-4">
          <div className="app-search-field">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search guests"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              aria-pressed={selectedStatus === null}
              onClick={() => setSelectedStatus(null)}
              className={`filter-pill ${selectedStatus === null ? 'filter-pill--active' : ''}`}
            >
              All Guests
            </button>
            {(['active', 'returning', 'vip', 'new'] as GuestStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={selectedStatus === status}
                onClick={() => setSelectedStatus(status)}
                className={`filter-pill ${selectedStatus === status ? 'filter-pill--active' : ''}`}
              >
                {STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </div>

        {filteredGuests.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No guests found. Enroll a guest to get started.
          </p>
        )}

        <div className="space-y-3 p-4 md:hidden">
          {pagination.paginatedItems.map((guest) => (
            <div
              key={guest.id}
              className={`elevated-list-item flex gap-3 p-4 ${
                selectedIds.has(guest.id) ? 'ring-2 ring-primary/25' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(guest.id)}
                onChange={() => toggleSelected(guest.id)}
                aria-label={`Select ${guest.name}`}
                className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary"
              />
              <button
                type="button"
                onClick={() => setSelectedGuest(guest)}
                className="min-w-0 flex-1 text-left"
              >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground inline-flex flex-wrap items-center gap-2">
                    {guest.name}
                    {guest.doNotDisturb && <GuestDndBadge compact />}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {guest.roomNumber ? `Room ${guest.roomNumber}` : 'No room assigned'}
                  </p>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(guest.status)}`}>
                  {STATUS_LABEL[guest.status]}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{guest.email ?? 'No email'}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                {guest.source ? (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getSourceColor(guest.source)}`}>
                    {SOURCE_LABEL[guest.source]}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{guest.totalStays} stays</span>
                )}
                <span className="font-bold text-foreground">₵{guest.totalSpent.toLocaleString()}</span>
              </div>
              </button>
            </div>
          ))}
        </div>

        <div className="hidden data-table-wrap overflow-x-auto px-4 md:block sm:px-6">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all visible guests"
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                </th>
                <th className="text-left font-semibold text-foreground">Guest Name</th>
                <th className="text-left font-semibold text-foreground">Contact</th>
                <th className="text-left font-semibold text-foreground">Source</th>
                <th className="text-center font-semibold text-foreground">Stays</th>
                <th className="text-right font-semibold text-foreground">Total Spent</th>
                <th className="text-center font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((guest) => (
                <tr
                  key={guest.id}
                  className={`cursor-pointer ${
                    selectedIds.has(guest.id) ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    setSelectedGuest(guest)
                    setEditingGuest(!readOnly && !hasPhoneNumber(guest.phone))
                  }}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(guest.id)}
                      onChange={() => toggleSelected(guest.id)}
                      aria-label={`Select ${guest.name}`}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground inline-flex flex-wrap items-center gap-2">
                    {guest.name}
                    {guest.doNotDisturb && <GuestDndBadge compact />}
                  </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {guest.roomNumber ? `Room ${guest.roomNumber}` : 'No room assigned'}
                    </p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {guest.email ?? '—'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {guest.phone ?? '—'}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {guest.source ? (
                      <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getSourceColor(guest.source)}`}>
                        {SOURCE_LABEL[guest.source]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <p className="font-bold text-foreground">{guest.totalStays}</p>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <p className="font-bold text-foreground">₵{guest.totalSpent.toLocaleString()}</p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(guest.status)} shadow-elevation-1`}>
                      {STATUS_LABEL[guest.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredGuests.length > 0 && (
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.setPage}
          />
        )}
      </div>

      <CenteredModal
        open={!!selectedGuest}
        onClose={() => {
          setSelectedGuest(null)
          setEditingGuest(false)
        }}
        className="max-w-lg"
        aria-label="Guest details"
      >
        {selectedGuest && (
          <>
            <ModalHeader onClose={() => {
              setSelectedGuest(null)
              setEditingGuest(false)
            }}>
              <h3 className="text-xl font-semibold inline-flex flex-wrap items-center gap-2">
                {selectedGuest.name}
                {selectedGuest.doNotDisturb && <GuestDndBadge compact />}
              </h3>
            </ModalHeader>

            <ModalBody className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="info-block info-block-blue p-4">
                  <p className="modal-panel-subtle text-xs font-semibold uppercase tracking-wider">
                    Total Stays
                  </p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{selectedGuest.totalStays}</p>
                </div>
                <div className="info-block info-block-emerald p-4">
                  <p className="modal-panel-subtle text-xs font-semibold uppercase tracking-wider">
                    Total Spent
                  </p>
                  <p className="text-2xl font-bold text-amber-600 mt-2">
                    ₵{selectedGuest.totalSpent.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Contact Information</h4>
                  {!readOnly && !editingGuest && (
                    <button
                      type="button"
                      onClick={() => setEditingGuest(true)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {hasPhoneNumber(selectedGuest.phone) ? 'Edit' : 'Add phone'}
                    </button>
                  )}
                </div>
                {!readOnly && editingGuest ? (
                  <GuestEditForm
                    guest={selectedGuest}
                    onCancel={() => setEditingGuest(false)}
                    onSaved={() => {
                      setEditingGuest(false)
                      setSelectedGuest(null)
                      router.refresh()
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <Mail className="h-5 w-5 text-primary" />
                      <span className="text-sm">{selectedGuest.email ?? 'No email on file'}</span>
                    </div>
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <Phone className="h-5 w-5 text-primary" />
                      <span className="text-sm">{selectedGuest.phone ?? 'No phone on file'}</span>
                    </div>
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <BedDouble className="h-5 w-5 text-primary" />
                      <span className="text-sm">
                        {selectedGuest.roomNumber ? `Room ${selectedGuest.roomNumber}` : 'No room assigned'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold">Stay Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface-inset p-3 rounded-xl">
                    <p className="modal-panel-subtle text-xs">Source</p>
                    <p className="text-sm font-semibold mt-1">
                      {selectedGuest.source ? SOURCE_LABEL[selectedGuest.source] : '—'}
                    </p>
                  </div>
                  <div className="surface-inset p-3 rounded-xl">
                    <p className="modal-panel-subtle text-xs">Last Stay</p>
                    <p className="text-sm font-semibold mt-1">{formatDate(selectedGuest.lastStay)}</p>
                  </div>
                  <div className="surface-inset p-3 rounded-xl">
                    <p className="modal-panel-subtle text-xs">Check-in</p>
                    <p className="text-sm font-semibold mt-1">{formatDate(selectedGuest.checkIn)}</p>
                  </div>
                  <div className="surface-inset p-3 rounded-xl">
                    <p className="modal-panel-subtle text-xs">Check-out</p>
                    <p className="text-sm font-semibold mt-1">{formatDate(selectedGuest.checkOut)}</p>
                  </div>
                </div>
              </div>

              {!readOnly && selectedGuest.isInHouse && (
                <GuestFolioPanel
                  guestId={selectedGuest.id}
                  guestName={selectedGuest.name}
                  reservationId={selectedGuest.reservationId}
                  readOnly={readOnly}
                />
              )}

              {!readOnly && <GuestAccessLink guest={selectedGuest} />}

              {!readOnly && selectedGuest.isInHouse && (
                <GuestCheckoutPanel
                  guest={selectedGuest}
                  onDone={() => {
                    setSelectedGuest(null)
                    router.refresh()
                  }}
                />
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Status:{' '}
                <span className={`px-2 py-0.5 rounded-full font-semibold ${getStatusColor(selectedGuest.status)}`}>
                  {STATUS_LABEL[selectedGuest.status]}
                </span>
              </div>
            </ModalBody>
          </>
        )}
      </CenteredModal>
    </>
  )
}

function GuestCheckoutPanel({
  guest,
  onDone,
}: {
  guest: GuestRow
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [earlyCheckout, setEarlyCheckout] = useState(false)
  const [markAsPaid, setMarkAsPaid] = useState(true)
  const [includeTax, setIncludeTax] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const methods: PaymentMethod[] = [
    'cash',
    'mtn_momo',
    'telecel_cash',
    'airteltigo',
    'visa',
    'mastercard',
    'bank_transfer',
  ]

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await checkOutGuest({
        guestId: guest.id,
        paymentMethod,
        earlyCheckout,
        markAsPaid,
        includeTax,
      })
      if (result.success) {
        toast.success('Guest checked out')
        onDone()
      } else setError(result.error ?? 'Check-out failed.')
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1"
      >
        <LogOut className="h-4 w-4" />
        Check out guest
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl surface-inset p-4">
      <p className="text-sm font-semibold">Check out & collect payment</p>
      <p className="text-xs text-muted-foreground">
        {includeTax
          ? 'A GRA tax invoice will be generated on check-out.'
          : 'Invoice will use the stay total without GRA taxes.'}
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeTax}
          onChange={(e) => setIncludeTax(e.target.checked)}
        />
        Include VAT &amp; GRA levies on invoice
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={earlyCheckout}
          onChange={(e) => setEarlyCheckout(e.target.checked)}
        />
        Early checkout (bill through today)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={markAsPaid}
          onChange={(e) => setMarkAsPaid(e.target.checked)}
        />
        Payment received now
      </label>
      <select
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm"
      >
        {methods.map((m) => (
          <option key={m} value={m}>
            {PAYMENT_METHOD_LABELS[m]}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="flex-[2] rounded-lg bg-[#3C216C] py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Processing…' : 'Confirm check-out'}
        </button>
      </div>
    </div>
  )
}

function GuestAccessLink({ guest }: { guest: GuestRow }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(guest.token)
  const [expiresAt, setExpiresAt] = useState<string | null>(guest.tokenExpiresAt)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Sync local state when a different guest is opened.
  useEffect(() => {
    setToken(guest.token)
    setExpiresAt(guest.tokenExpiresAt)
    setError(null)
  }, [guest.id, guest.token, guest.tokenExpiresAt])

  const url = token ? `${window.location.origin}/guest/enter?t=${encodeURIComponent(token)}` : ''
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false
  const linkActive = Boolean(token) && !expired

  useEffect(() => {
    if (!url || expired) {
      setQr('')
      return
    }
    QRCode.toDataURL(url, { width: 240 })
      .then(setQr)
      .catch(() => setQr(''))
  }, [url, expired])

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleRevoke() {
    setError(null)
    startTransition(async () => {
      const result = await revokeGuestAccess(guest.id)
      if (result.success) {
        setToken(null)
        setExpiresAt(new Date().toISOString())
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function handleRegenerate() {
    setError(null)
    startTransition(async () => {
      const result = await regenerateGuestAccess(guest.id)
      if (result.success && result.data) {
        setToken(result.data.token)
        setExpiresAt(result.data.tokenExpiresAt)
        router.refresh()
      } else if (!result.success) {
        setError(result.error)
      }
    })
  }

  const message = `Hi ${guest.name}, here is your guest portal access link${
    guest.roomNumber ? ` for Room ${guest.roomNumber}` : ''
  }: ${url}`
  const phoneDigits = (guest.phone ?? '').replace(/[^0-9]/g, '')
  const waHref = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
  const mailHref = guest.email
    ? `mailto:${guest.email}?subject=${encodeURIComponent('Your guest portal access link')}&body=${encodeURIComponent(message)}`
    : null

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 font-semibold">
        <Link2 className="h-4 w-4 text-primary" />
        Guest Access Link
      </h4>

      {!linkActive ? (
        <div className="space-y-3">
          <p className="surface-inset rounded-xl p-3 text-sm text-muted-foreground">
            {token === null
              ? 'No active access link. Generate one to give this guest portal access.'
              : 'This access link has expired (stay ended).'}
          </p>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {pending ? 'Generating…' : 'Generate new link'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 surface-inset rounded-xl p-3">
            <span className="flex-1 truncate text-xs text-muted-foreground">{url}</span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="Guest portal QR code"
                className="h-28 w-28 rounded-lg border border-border bg-white p-1"
              />
            )}
            <div className="flex flex-1 flex-col gap-2">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2"
              >
                <MessageCircle className="h-4 w-4" />
                Share via WhatsApp
              </a>
              {mailHref && (
                <a
                  href={mailHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2"
                >
                  <Mail className="h-4 w-4" />
                  Share via Email
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Revoke link
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function GuestEditForm({
  guest,
  onCancel,
  onSaved,
}: {
  guest: GuestRow
  onCancel: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(guest.name)
  const [email, setEmail] = useState(guest.email ?? '')
  const [phone, setPhone] = useState(guest.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const result = await updateGuest({
        guestId: guest.id,
        name,
        email: email || undefined,
        phone,
      })
      if (result.success) {
        toast.success('Guest profile updated')
        onSaved()
      } else {
        setError(result.error ?? 'Could not save.')
        toast.error(result.error ?? 'Could not save.')
      }
    })
  }

  return (
    <div className="space-y-3 rounded-xl surface-inset p-4">
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground">Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg bg-secondary py-2 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

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
  Trash2,
  FileText,
  Receipt,
} from 'lucide-react'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import { regenerateGuestAccess, revokeGuestAccess, checkOutGuest, updateGuest } from '@/app/actions/guest'
import {
  eraseGuestPersonalData,
  getGuestDeleteEligibility,
  hardDeleteGuest,
} from '@/app/actions/guest-privacy'
import { issueStayInvoice } from '@/app/actions/invoices'
import { CheckoutInvoiceDialog } from '@/components/dashboard/checkout-invoice-dialog'
import { GuestFolioPanel } from '@/components/dashboard/guest-folio-panel'
import { GuestsBulkBar } from '@/components/dashboard/guests-bulk-bar'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { hasPhoneNumber } from '@/lib/phone'
import { usePagination } from '@/lib/hooks/use-pagination'
import { toast } from 'sonner'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { InvoiceExportRow } from '@/lib/export/types'
import type { PaymentMethod } from '@/types'
import { canEraseGuestData } from '@/lib/auth/tenant-access'
import {
  DIRECTORY_FILTERS,
  DIRECTORY_FILTER_LABEL,
  guestMatchesDirectoryFilter,
  guestRoomLabel,
  LOYALTY_LABEL,
  OCCUPANCY_LABEL,
  sortGuestDirectory,
  type GuestDirectoryFilter,
  type GuestLoyalty,
  type GuestOccupancy,
  type GuestRow,
} from '@/lib/guests/guest-directory'
import type { ReservationChannel, UserRole } from '@/types'

interface GuestsServerPagination {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
}

interface GuestsTableProps {
  guests: GuestRow[]
  initialSearch?: string
  openGuestId?: string
  readOnly?: boolean
  /** When set, erase/delete is shown only for manager+ roles. */
  staffRole?: UserRole
  serverPagination?: GuestsServerPagination
  initialStatus?: GuestDirectoryFilter | null
}

function occupancyClass(occupancy: GuestOccupancy) {
  switch (occupancy) {
    case 'overstay':
      return 'bg-red-700 text-white'
    case 'checking_out':
      return 'bg-orange-600 text-white'
    case 'in_house':
      return 'bg-amber-600 text-amber-50'
    case 'upcoming':
      return 'bg-sky-700 text-white'
    case 'departed':
      return 'bg-gray-500 text-gray-50'
    default:
      return 'bg-gray-200 text-gray-700'
  }
}

function loyaltyClass(loyalty: GuestLoyalty) {
  switch (loyalty) {
    case 'vip':
      return 'bg-[#3C216C] text-white'
    case 'returning':
      return 'bg-blue-600 text-blue-50'
    default:
      return 'bg-gray-500 text-gray-50'
  }
}

function GuestDirectoryBadges({ guest, compact = false }: { guest: GuestRow; compact?: boolean }) {
  const pill = compact ? 'text-xs px-2.5 py-1 rounded-full font-semibold' : 'text-xs px-3 py-1.5 rounded-full font-semibold shadow-elevation-1'
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      {guest.occupancy !== 'none' && (
        <span className={`${pill} ${occupancyClass(guest.occupancy)}`}>
          {OCCUPANCY_LABEL[guest.occupancy]}
        </span>
      )}
      <span className={`${pill} ${loyaltyClass(guest.loyalty)}`}>{LOYALTY_LABEL[guest.loyalty]}</span>
    </span>
  )
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
  staffRole,
  serverPagination,
  initialStatus = null,
}: GuestsTableProps) {
  const canErase = canEraseGuestData(staffRole)
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [selectedStatus, setSelectedStatus] = useState<GuestDirectoryFilter | null>(initialStatus)
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null)
  const [stayInvoice, setStayInvoice] = useState<{
    id: string
    guestName: string
    reservationId: string
    preview?: InvoiceExportRow
  } | null>(null)

  useEffect(() => {
    setSearchQuery(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    setSelectedStatus(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    if (!serverPagination) return
    const trimmed = searchQuery.trim()
    if (trimmed === initialSearch.trim() && selectedStatus === initialStatus) return

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (trimmed) params.set('q', trimmed)
      if (selectedStatus) params.set('status', selectedStatus)
      if (openGuestId) params.set('open', openGuestId)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?')
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [
    searchQuery,
    initialSearch,
    selectedStatus,
    initialStatus,
    serverPagination,
    router,
    openGuestId,
  ])

  function pushGuestListPage(nextPage: number) {
    const params = new URLSearchParams()
    if (nextPage > 1) params.set('page', String(nextPage))
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedStatus) params.set('status', selectedStatus)
    if (openGuestId) params.set('open', openGuestId)
    const qs = params.toString()
    router.push(qs ? `?${qs}` : '?')
  }

  useEffect(() => {
    if (!openGuestId) return
    const guest = guests.find((g) => g.id === openGuestId)
    if (guest) setSelectedGuest(guest)
  }, [openGuestId, guests])
  const [editingGuest, setEditingGuest] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const filteredGuests = useMemo(() => {
    if (serverPagination) {
      if (!selectedStatus) return guests
      return guests.filter((guest) => guestMatchesDirectoryFilter(guest, selectedStatus))
    }

    const filtered = guests.filter((guest) => {
      const matchesSearch =
        guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (guest.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (guest.phone ?? '').includes(searchQuery)
      const matchesStatus = guestMatchesDirectoryFilter(guest, selectedStatus)
      return matchesSearch && matchesStatus
    })
    return sortGuestDirectory(filtered)
  }, [guests, searchQuery, selectedStatus, serverPagination])

  const bulkSelected = useMemo(
    () => guests.filter((g) => selectedIds.has(g.id)),
    [guests, selectedIds],
  )

  const allFilteredSelected =
    filteredGuests.length > 0 && filteredGuests.every((g) => selectedIds.has(g.id))

  const clientPagination = usePagination(
    filteredGuests,
    10,
    `${searchQuery}|${selectedStatus ?? ''}`,
  )

  const displayGuests = serverPagination ? filteredGuests : clientPagination.paginatedItems
  const pagination = serverPagination
    ? {
        page: serverPagination.page,
        totalPages: serverPagination.totalPages,
        totalItems: serverPagination.totalItems,
        rangeStart:
          serverPagination.totalItems === 0
            ? 0
            : (serverPagination.page - 1) * serverPagination.pageSize + 1,
        rangeEnd: Math.min(
          serverPagination.page * serverPagination.pageSize,
          serverPagination.totalItems,
        ),
        setPage: pushGuestListPage,
      }
    : {
        page: clientPagination.page,
        totalPages: clientPagination.totalPages,
        totalItems: clientPagination.totalItems,
        rangeStart: clientPagination.rangeStart,
        rangeEnd: clientPagination.rangeEnd,
        setPage: clientPagination.setPage,
      }

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
            {DIRECTORY_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={selectedStatus === status}
                onClick={() => setSelectedStatus(status)}
                className={`filter-pill ${selectedStatus === status ? 'filter-pill--active' : ''}`}
              >
                {DIRECTORY_FILTER_LABEL[status]}
              </button>
            ))}
          </div>
        </div>

        {filteredGuests.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No guests found. Register an in-house guest or check someone in to get started.
          </p>
        )}

        <div className="space-y-3 p-4 md:hidden">
          {displayGuests.map((guest) => (
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
                    {guestRoomLabel(guest)}
                  </p>
                </div>
                <GuestDirectoryBadges guest={guest} compact />
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
              {displayGuests.map((guest) => (
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
                      {guestRoomLabel(guest)}
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
                    <GuestDirectoryBadges guest={guest} />
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
                  <p className="modal-panel-subtle text-xs font-medium text-muted-foreground">
                    Total Stays
                  </p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{selectedGuest.totalStays}</p>
                </div>
                <div className="info-block info-block-emerald p-4">
                  <p className="modal-panel-subtle text-xs font-medium text-muted-foreground">
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
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="text-sm">
                        {selectedGuest.ghanaCardNumber
                          ? `Tax ID ${selectedGuest.ghanaCardNumber}`
                          : 'No Ghana Card on file'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <BedDouble className="h-5 w-5 text-primary" />
                      <span className="text-sm">{guestRoomLabel(selectedGuest)}</span>
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

              {!readOnly && selectedGuest.isInHouse && selectedGuest.reservationId && (
                <GuestStayInvoicePanel
                  guest={selectedGuest}
                  onIssued={(invoiceId, preview) => {
                    setStayInvoice({
                      id: invoiceId,
                      guestName: selectedGuest.name,
                      reservationId: selectedGuest.reservationId!,
                      preview,
                    })
                    router.refresh()
                  }}
                />
              )}

              {!readOnly && selectedGuest.isInHouse && !selectedGuest.reservationId && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  No linked reservation — open Reservations to issue a stay invoice for this guest.
                </p>
              )}

              {!readOnly && <GuestAccessLink guest={selectedGuest} />}

              {!readOnly && selectedGuest.canCheckOut && (
                <GuestCheckoutPanel
                  guest={selectedGuest}
                  onDone={() => {
                    setSelectedGuest(null)
                    router.refresh()
                  }}
                />
              )}

              {!readOnly && selectedGuest.isInHouse && !selectedGuest.canCheckOut && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  This stay is on dispute hold. Complete checkout from Reservations.
                </p>
              )}

              {!readOnly && canErase && (
                <GuestDeletePanel
                  guest={selectedGuest}
                  onDone={() => {
                    setSelectedGuest(null)
                    router.refresh()
                  }}
                />
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Status: <GuestDirectoryBadges guest={selectedGuest} compact />
              </div>
            </ModalBody>
          </>
        )}
      </CenteredModal>

      {stayInvoice && (
        <CheckoutInvoiceDialog
          invoiceId={stayInvoice.id}
          guestName={stayInvoice.guestName}
          initialInvoice={stayInvoice.preview}
          reservationId={stayInvoice.reservationId}
          mode="collect"
          description={`${stayInvoice.guestName} — stay invoice from check-in dates. Collect payment before enter.`}
          onClose={() => {
            setStayInvoice(null)
            router.refresh()
          }}
          onSettled={() => router.refresh()}
        />
      )}
    </>
  )
}

function GuestStayInvoicePanel({
  guest,
  onIssued,
}: {
  guest: GuestRow
  onIssued: (invoiceId: string, preview?: InvoiceExportRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
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
    if (!guest.reservationId) return
    setError(null)
    startTransition(async () => {
      const result = await issueStayInvoice({
        reservationId: guest.reservationId,
        paymentMethod,
        markAsPaid,
        includeTax,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(
        result.created
          ? 'Stay invoice generated'
          : markAsPaid
            ? 'Payment recorded'
            : 'Stay invoice refreshed',
      )
      setOpen(false)
      onIssued(result.invoiceId, result.invoicePreview)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A62E] py-3 text-sm font-semibold text-gray-900 shadow-elevation-1"
      >
        <Receipt className="h-4 w-4" />
        Generate stay invoice & collect
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl surface-inset p-4">
      <p className="text-sm font-semibold">Generate stay invoice</p>
      <p className="text-xs text-muted-foreground">
        Uses this guest&apos;s check-in ({formatDate(guest.checkIn)}) → check-out (
        {formatDate(guest.checkOut)})
        {guest.roomNumber ? ` · Room ${guest.roomNumber}` : ''}. Creates or refreshes the stay
        invoice for pay-before-enter.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeTax}
          onChange={(e) => setIncludeTax(e.target.checked)}
        />
        Include VAT &amp; GRA levies
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={markAsPaid}
          onChange={(e) => setMarkAsPaid(e.target.checked)}
        />
        Paid in full now
      </label>
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
          className="flex-[2] rounded-lg bg-[#D4A62E] py-2 text-sm font-semibold text-gray-900 disabled:opacity-50"
        >
          {pending ? 'Saving…' : markAsPaid ? 'Generate & mark paid' : 'Generate invoice'}
        </button>
      </div>
    </div>
  )
}

function GuestDeletePanel({
  guest,
  onDone,
}: {
  guest: GuestRow
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [loadingEligibility, setLoadingEligibility] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<{
    isInHouse: boolean
    canSoftErase: boolean
    canHardDelete: boolean
    blockReason: string | null
    historyCounts: { reservations: number; invoices: number; complaints: number }
  } | null>(null)

  function openDialog() {
    setError(null)
    setEligibility(null)
    setOpen(true)
    setLoadingEligibility(true)
    void getGuestDeleteEligibility(guest.id).then((result) => {
      setLoadingEligibility(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      setEligibility(result.data)
    })
  }

  function runSoftErase() {
    setError(null)
    startTransition(async () => {
      const result = await eraseGuestPersonalData(guest.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success('Guest personal data erased')
      setOpen(false)
      onDone()
    })
  }

  function runHardDelete() {
    setError(null)
    startTransition(async () => {
      const result = await hardDeleteGuest(guest.id)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success('Guest deleted')
      setOpen(false)
      onDone()
    })
  }

  const alreadyRedacted = guest.name === 'Redacted guest' && !guest.phone && !guest.email

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        title="Erase personal data or delete duplicate"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-800"
      >
        <Trash2 className="h-4 w-4" />
        {alreadyRedacted ? 'Delete guest record' : 'Erase / delete guest'}
      </button>

      <CenteredModal
        open={open}
        onClose={() => !pending && setOpen(false)}
        className="max-w-md"
        aria-label="Erase or delete guest"
      >
        <ModalHeader onClose={() => !pending && setOpen(false)}>
          <h3 className="text-lg font-semibold">Erase or delete guest</h3>
          <p className="modal-panel-subtle text-sm">{guest.name}</p>
        </ModalHeader>
        <ModalBody className="space-y-3">
          {loadingEligibility && (
            <p className="text-sm text-muted-foreground">Checking stay and billing history…</p>
          )}
          {eligibility?.blockReason && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {eligibility.blockReason}
            </p>
          )}
          {eligibility && (
            <>
              {eligibility.canHardDelete ? (
                <p className="text-sm text-muted-foreground">
                  This guest has no reservations, invoices, or complaints. You can permanently
                  delete the record (e.g. a duplicate entry).
                </p>
              ) : (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Soft erase clears name, phone, email, Ghana Card, and portal access. Stay and
                    invoice history stay on file for compliance — invoices remain printable.
                  </p>
                  <p className="text-xs">
                    Linked history: {eligibility.historyCounts.reservations} reservation
                    {eligibility.historyCounts.reservations === 1 ? '' : 's'},{' '}
                    {eligibility.historyCounts.invoices} invoice
                    {eligibility.historyCounts.invoices === 1 ? '' : 's'},{' '}
                    {eligibility.historyCounts.complaints} complaint
                    {eligibility.historyCounts.complaints === 1 ? '' : 's'}.
                  </p>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          {eligibility?.canSoftErase && !eligibility.canHardDelete && (
            <button
              type="button"
              disabled={pending || loadingEligibility}
              onClick={runSoftErase}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50"
            >
              {pending ? 'Erasing…' : 'Erase personal data'}
            </button>
          )}
          {eligibility?.canHardDelete && (
            <button
              type="button"
              disabled={pending || loadingEligibility}
              onClick={runHardDelete}
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? 'Deleting…' : 'Permanently delete'}
            </button>
          )}
          {eligibility?.canSoftErase && eligibility.canHardDelete && (
            <button
              type="button"
              disabled={pending || loadingEligibility}
              onClick={runSoftErase}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              Erase instead
            </button>
          )}
        </ModalFooter>
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
      <p className="text-sm font-semibold">Complete checkout</p>
      <p className="text-xs text-muted-foreground">
        Stay payment is taken at check-in. Checkout refreshes the same invoice for any extras, then
        releases the room. Collect remaining balance if outstanding — use Walkout on Reservations if
        they left unpaid.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={includeTax}
          onChange={(e) => setIncludeTax(e.target.checked)}
        />
        Include VAT &amp; GRA levies on invoice refresh
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={earlyCheckout}
          onChange={(e) => setEarlyCheckout(e.target.checked)}
        />
        Early checkout (bill through today)
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={markAsPaid}
          onChange={(e) => setMarkAsPaid(e.target.checked)}
        />
        Any remaining balance received now (required if outstanding)
      </label>
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
          disabled={pending || !markAsPaid}
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
  const [pin, setPin] = useState<string | null>(guest.portalPin)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Sync local state when a different guest is opened.
  useEffect(() => {
    setToken(guest.token)
    setExpiresAt(guest.tokenExpiresAt)
    setPin(guest.portalPin)
    setError(null)
  }, [guest.id, guest.token, guest.tokenExpiresAt, guest.portalPin])

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
        setPin(result.data.portalPin)
        router.refresh()
      } else if (!result.success) {
        setError(result.error)
      }
    })
  }

  const message = pin
    ? `Hi ${guest.name}, welcome to ${guest.roomNumber ? `Room ${guest.roomNumber}` : 'your stay'}. Open the property guest portal QR, then sign in with your room number and this PIN: ${pin}. You can also use this personal link: ${url}`
    : `Hi ${guest.name}, here is your guest portal access link${
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
            {guest.isInHouse
              ? token === null
                ? 'No active access link. Generate one to give this guest portal access.'
                : 'This access link has expired (stay ended).'
              : 'Portal access ended at check-out. Issue a new link only after they are in-house again.'}
          </p>
          {guest.isInHouse && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {pending ? 'Generating…' : 'Generate new link'}
            </button>
          )}
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

          <div className="flex items-center justify-between gap-3 surface-inset rounded-xl p-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Portal login code</p>
              <p className="text-[11px] text-muted-foreground/80">
                Guest enters room number + this code after scanning the property QR.
              </p>
            </div>
            {pin ? (
              <span className="shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.3em] text-primary">
                {pin}
              </span>
            ) : guest.isInHouse ? (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={pending}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {pending ? 'Creating…' : 'Create code'}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Ended</span>
            )}
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
            {guest.isInHouse && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            )}
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
  const [ghanaCardNumber, setGhanaCardNumber] = useState(guest.ghanaCardNumber ?? '')
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
        ghanaCardNumber,
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
      <div>
        <label className="text-xs font-semibold text-muted-foreground">
          Ghana Card (tax ID)
        </label>
        <input
          value={ghanaCardNumber}
          onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
          placeholder="GHA-728071939-8"
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm uppercase"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on invoices as Tax ID. Format GHA-#########-#
        </p>
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

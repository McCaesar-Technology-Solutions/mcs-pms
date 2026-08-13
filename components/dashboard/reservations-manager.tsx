'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, LogIn, LogOut, Plus, Receipt, Search, X, XCircle, CalendarPlus, ArrowRightLeft, UserX, Pencil } from 'lucide-react'
import { issueStayInvoice } from '@/app/actions/invoices'
import { CheckoutInvoiceDialog } from '@/components/dashboard/checkout-invoice-dialog'
import {
  bookAndCheckIn,
  cancelReservation,
  beginCheckoutReservation,
  completeCheckoutReservation,
  recordWalkoutReservation,
  approveLateCheckoutReservation,
  createReservation,
  markChannelPrepaid,
  recordReservationDeposit,
  updateReservation,
} from '@/app/actions/reservations'
import { initiateStaffDepositPayment } from '@/app/actions/payments'
import {
  beginDisputeHold,
  checkInStay,
  extendStay,
  markNoShow,
  moveStayRoom,
  releaseNoShowRoomHold,
} from '@/app/actions/stays'
import { GuestSearchField } from '@/components/dashboard/guest-search-field'
import { APP_FIELD_CLASS, FormField } from '@/components/ui/form-field'
import { formatGhs, MONEY_CLASS } from '@/lib/format/money'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import { PortalLinkPanel } from '@/components/dashboard/portal-link-panel'
import { ReservationsBulkBar } from '@/components/dashboard/reservations-bulk-bar'
import { TablePagination } from '@/components/dashboard/table-pagination'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import type { InvoiceExportRow } from '@/lib/export/types'
import type { PaymentMethod, Reservation, ReservationChannel, ReservationPaymentStatus, RateType, UserRole } from '@/types'
import type { DepositDisposition } from '@/lib/billing/deposit-disposition'
import { computeDiscountAmount, type DiscountType } from '@/lib/billing/discount'
import { canApplyGuestDiscount, canOmitInvoiceTax } from '@/lib/auth/tenant-access'
import {
  canCheckIn,
  canCancelReservationStatus,
  canUpdateReservationFields,
  getAvailableActions,
  reservationStatusLabel,
} from '@/lib/reservations/lifecycle'
import type { RoomOption } from '@/lib/data/dashboard'
import type { OccupancySpan } from '@/lib/data/occupancy'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import { calculateStayTotal, rateTypeLabel } from '@/lib/pricing/stay-totals'
import { usePagination } from '@/lib/hooks/use-pagination'
import {
  isSecuredPaymentStatus,
  RESERVATION_PAYMENT_FILTERS,
  RESERVATION_STATUS_FILTERS,
} from '@/lib/reservations/search-params'

const STATUS_FILTERS = RESERVATION_STATUS_FILTERS

const PAYMENT_FILTERS = RESERVATION_PAYMENT_FILTERS

const CHANNEL_LABELS: Record<ReservationChannel, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  direct: 'Direct',
  walk_in: 'Walk-in',
  other: 'Other',
}

function formatStatus(status: string) {
  return reservationStatusLabel(status)
}

function statusBadge(status: string) {
  switch (status) {
    case 'inquiry':
      return 'bg-gray-100 text-gray-700'
    case 'provisional':
      return 'bg-blue-100 text-blue-800'
    case 'confirmed':
      return 'bg-teal-100 text-teal-800'
    case 'pre_arrival':
      return 'bg-teal-200 text-teal-900'
    case 'checked_in':
      return 'bg-emerald-100 text-emerald-800'
    case 'checkout_in_progress':
      return 'bg-amber-100 text-amber-900'
    case 'checked_out':
    case 'post_stay':
    case 'archived':
    case 'released':
      return 'bg-[var(--comp-slate-soft)] text-[var(--comp-slate-ink)]'
    case 'cancelled':
    case 'no_show':
    case 'walkout':
      return 'bg-red-100 text-red-700'
    case 'overstay':
      return 'bg-red-100 text-red-800 ring-1 ring-red-300'
    case 'dispute_hold':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function paymentBadge(status: ReservationPaymentStatus) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-800'
    case 'deposit_paid':
    case 'partial':
      return 'bg-sky-100 text-sky-800'
    case 'overdue':
      return 'bg-red-100 text-red-700'
    case 'refunded':
      return 'bg-gray-100 text-gray-600'
    case 'complimentary':
      return 'bg-violet-100 text-violet-800'
    case 'pending':
    case 'unpaid':
    default:
      return 'bg-amber-100 text-amber-800'
  }
}

function formatPaymentStatus(status: ReservationPaymentStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function sourceBadge(source: string) {
  const colors: Record<string, string> = {
    website: 'bg-[var(--comp-sky-soft)] text-[var(--comp-sky-ink)]',
    airbnb: 'bg-[var(--comp-coral-soft)] text-[var(--comp-coral-ink)]',
    booking: 'bg-[var(--comp-slate-soft)] text-[var(--comp-slate-ink)]',
    walk_in: 'bg-[var(--comp-sand-soft)] text-[var(--comp-sand-ink)]',
    other: 'bg-gray-50 text-gray-700',
  }
  return colors[source] || colors.other
}

interface ReservationsServerPagination {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
}

interface ReservationsManagerProps {
  reservations: Reservation[]
  roomOptions: RoomOption[]
  occupancySpans: OccupancySpan[]
  initialSearch?: string
  openReservationId?: string
  initialExtendStay?: boolean
  initialExtendDate?: string
  initialGuestRequestId?: string
  initialNewFlow?: 'book' | 'check_in'
  staffRole?: UserRole
  initialCheckInDate?: string
  initialCheckOutDate?: string
  initialStatus?: (typeof STATUS_FILTERS)[number]
  initialPaymentStatus?: (typeof PAYMENT_FILTERS)[number]
  initialPaymentSecured?: boolean
  serverPagination?: ReservationsServerPagination
  onlinePaymentsEnabled?: boolean
}

function isSecuredReservationPayment(res: Reservation): boolean {
  return isSecuredPaymentStatus(res.paymentStatus, res.depositAmount)
}

export function ReservationsManager({
  reservations,
  roomOptions,
  occupancySpans,
  initialSearch = '',
  openReservationId,
  initialExtendStay = false,
  initialExtendDate,
  initialGuestRequestId,
  initialNewFlow,
  staffRole = 'receptionist',
  initialCheckInDate,
  initialCheckOutDate,
  initialStatus,
  initialPaymentStatus = 'all',
  initialPaymentSecured = false,
  serverPagination,
  onlinePaymentsEnabled = false,
}: ReservationsManagerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(openReservationId ?? null)
  const [search, setSearch] = useState(initialSearch)

  useEffect(() => {
    if (openReservationId) setSelectedId(openReservationId)
  }, [openReservationId])

  useEffect(() => {
    setSearch(initialSearch)
  }, [initialSearch])

  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>(
    initialStatus ?? 'all',
  )
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]>(
    initialPaymentStatus,
  )
  const [checkInDateFilter, setCheckInDateFilter] = useState(initialCheckInDate ?? '')
  const [checkOutDateFilter, setCheckOutDateFilter] = useState(initialCheckOutDate ?? '')
  const [paymentSecuredFilter, setPaymentSecuredFilter] = useState(initialPaymentSecured)
  const [creating, setCreating] = useState(Boolean(initialNewFlow))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [checkoutInvoice, setCheckoutInvoice] = useState<{
    id: string
    guestName: string
    preview?: InvoiceExportRow
    reservationId?: string
    mode?: 'view' | 'collect'
  } | null>(null)

  function openStayInvoice(
    invoiceId: string,
    guestName: string,
    preview?: InvoiceExportRow,
    options?: { reservationId?: string; mode?: 'view' | 'collect' },
  ) {
    setCheckoutInvoice({
      id: invoiceId,
      guestName,
      preview,
      reservationId: options?.reservationId,
      mode: options?.mode ?? 'view',
    })
    router.refresh()
  }
  const [activeGuestRequestId, setActiveGuestRequestId] = useState<string | null>(
    initialGuestRequestId ?? null,
  )

  useEffect(() => {
    setStatusFilter(initialStatus ?? 'all')
  }, [initialStatus])

  useEffect(() => {
    setPaymentFilter(initialPaymentStatus)
  }, [initialPaymentStatus])

  useEffect(() => {
    setCheckInDateFilter(initialCheckInDate ?? '')
  }, [initialCheckInDate])

  useEffect(() => {
    setCheckOutDateFilter(initialCheckOutDate ?? '')
  }, [initialCheckOutDate])

  useEffect(() => {
    setPaymentSecuredFilter(initialPaymentSecured)
  }, [initialPaymentSecured])

  useEffect(() => {
    setActiveGuestRequestId(initialGuestRequestId ?? null)
  }, [initialGuestRequestId])

  function buildListParams(overrides: Record<string, string | null | undefined> = {}) {
    const next = new URLSearchParams(searchParams.toString())
    const apply = (key: string, value: string | null | undefined) => {
      if (value == null || value === '' || value === 'all') next.delete(key)
      else next.set(key, value)
    }

    apply('q', 'q' in overrides ? overrides.q : search.trim() || null)
    apply(
      'status',
      'status' in overrides ? overrides.status : statusFilter === 'all' ? null : statusFilter,
    )
    apply(
      'pay',
      'pay' in overrides ? overrides.pay : paymentFilter === 'all' ? null : paymentFilter,
    )
    apply('checkIn', 'checkIn' in overrides ? overrides.checkIn : checkInDateFilter || null)
    apply('checkOut', 'checkOut' in overrides ? overrides.checkOut : checkOutDateFilter || null)

    if ('payment' in overrides) {
      apply('payment', overrides.payment)
    } else if (paymentSecuredFilter) {
      next.set('payment', 'secured')
    } else {
      next.delete('payment')
    }

    if ('page' in overrides) apply('page', overrides.page)
    else next.delete('page')

    return next
  }

  function pushListQuery(overrides: Record<string, string | null | undefined> = {}) {
    const next = buildListParams(overrides)
    const query = next.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  useEffect(() => {
    if (!serverPagination) return
    const trimmed = search.trim()
    if (trimmed === (initialSearch ?? '').trim()) return

    const timeout = window.setTimeout(() => {
      pushListQuery({ q: trimmed || null, page: null })
    }, 400)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search only
  }, [search, initialSearch, serverPagination])

  const filtered = useMemo(() => {
    if (serverPagination) return reservations

    const q = search.toLowerCase()
    return reservations.filter((res) => {
      const matchesSearch =
        !q ||
        res.guestName.toLowerCase().includes(q) ||
        res.bookingRef.toLowerCase().includes(q) ||
        res.roomNumber.includes(q)
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter
      const matchesPayment = paymentFilter === 'all' || res.paymentStatus === paymentFilter
      const matchesCheckIn = !checkInDateFilter || res.checkInDate === checkInDateFilter
      const matchesCheckOut = !checkOutDateFilter || res.checkOutDate === checkOutDateFilter
      const matchesSecured = !paymentSecuredFilter || isSecuredReservationPayment(res)
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesCheckIn &&
        matchesCheckOut &&
        matchesSecured
      )
    })
  }, [
    reservations,
    search,
    statusFilter,
    paymentFilter,
    checkInDateFilter,
    checkOutDateFilter,
    paymentSecuredFilter,
    serverPagination,
  ])

  const selected = selectedId ? reservations.find((r) => r.id === selectedId) ?? null : null
  const bulkSelected = useMemo(
    () => reservations.filter((r) => selectedIds.has(r.id)),
    [reservations, selectedIds],
  )

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))

  const clientPagination = usePagination(
    filtered,
    10,
    `${search}|${statusFilter}|${paymentFilter}`,
  )

  const displayReservations = serverPagination ? filtered : clientPagination.paginatedItems
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
        setPage: (nextPage: number) =>
          pushListQuery({ page: nextPage > 1 ? String(nextPage) : null }),
      }
    : {
        page: clientPagination.page,
        totalPages: clientPagination.totalPages,
        totalItems: clientPagination.totalItems,
        rangeStart: clientPagination.rangeStart,
        rangeEnd: clientPagination.rangeEnd,
        setPage: clientPagination.setPage,
      }

  function clearReservationDeepLink(closeReservation = false) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('extend')
    next.delete('extendDate')
    next.delete('guestRequest')
    if (closeReservation) next.delete('open')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
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
        filtered.forEach((r) => next.delete(r.id))
      } else {
        filtered.forEach((r) => next.add(r.id))
      }
      return next
    })
  }

  function onStatusFilterChange(status: (typeof STATUS_FILTERS)[number]) {
    setStatusFilter(status)
    if (serverPagination) {
      pushListQuery({ status: status === 'all' ? null : status, page: null })
    }
  }

  function onPaymentFilterChange(status: (typeof PAYMENT_FILTERS)[number]) {
    setPaymentFilter(status)
    if (serverPagination) {
      pushListQuery({ pay: status === 'all' ? null : status, page: null })
    }
  }

  const listCountLabel = serverPagination
    ? `${pagination.rangeStart}–${pagination.rangeEnd} of ${pagination.totalItems} reservations`
    : `${filtered.length} of ${reservations.length} reservations`

  return (
    <>
      <ReservationsBulkBar
        selected={bulkSelected}
        onClear={() => setSelectedIds(new Set())}
        onMutated={() => router.refresh()}
      />
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />

        <div className="surface-card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">All Reservations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {listCountLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            New reservation
          </button>
        </div>

        <div className="surface-card-header space-y-4">
          <div className="app-search-field">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search reservations"
              placeholder="Search guest, ref, room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => onStatusFilterChange(status)}
                className={`filter-pill ${statusFilter === status ? 'filter-pill--active' : ''}`}
              >
                {status === 'all' ? 'All' : formatStatus(status)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {PAYMENT_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={paymentFilter === status}
                onClick={() => onPaymentFilterChange(status)}
                className={`filter-pill filter-pill--sm ${paymentFilter === status ? 'filter-pill--active' : ''}`}
              >
                {status === 'all' ? 'Any payment' : formatPaymentStatus(status as ReservationPaymentStatus)}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-4 md:hidden">
          {filtered.length === 0 && pagination.totalItems === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No reservations match your filters.
            </p>
          ) : (
            displayReservations.map((res) => (
              <div
                key={res.id}
                className={`elevated-list-item flex gap-3 p-4 ${
                  selectedIds.has(res.id) ? 'ring-2 ring-primary/25' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(res.id)}
                  onChange={() => toggleSelected(res.id)}
                  aria-label={`Select ${res.guestName}`}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary"
                />
                <button
                  type="button"
                  onClick={() => setSelectedId(res.id)}
                  className="min-w-0 flex-1 text-left"
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground inline-flex flex-wrap items-center gap-2">
                      {res.guestName}
                      {res.guestDoNotDisturb && <GuestDndBadge compact />}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {res.bookingRef} · Room {res.roomNumber}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                  <span className="text-foreground"> · {res.numberOfNights}n</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(res.status)}`}
                    >
                      {formatStatus(res.status)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentBadge(res.paymentStatus)}`}
                    >
                      {formatPaymentStatus(res.paymentStatus)}
                    </span>
                  </div>
                  <span className={`font-semibold text-foreground ${MONEY_CLASS}`}>{formatGhs(res.totalPrice)}</span>
                </div>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="w-10 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all visible reservations"
                    className="h-4 w-4 rounded border-border text-primary"
                  />
                </th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Guest</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Reference</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Room</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Stay</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Status</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Payment</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Source</th>
                <th className="px-4 py-4 text-right font-semibold text-foreground">Amount</th>
                <th className="w-10 px-4 py-4 text-center font-semibold text-foreground" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && pagination.totalItems === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    No reservations match your filters.
                  </td>
                </tr>
              ) : (
                displayReservations.map((res) => (
                  <tr
                    key={res.id}
                    className={`cursor-pointer ${
                      selectedId === res.id ? 'is-selected' : ''
                    } ${selectedIds.has(res.id) ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(res.id)}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(res.id)}
                        onChange={() => toggleSelected(res.id)}
                        aria-label={`Select ${res.guestName}`}
                        className="h-4 w-4 rounded border-border text-primary"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground inline-flex flex-wrap items-center gap-2">
                      {res.guestName}
                      {res.guestDoNotDisturb && <GuestDndBadge compact />}
                    </p>
                      {res.guestEmail && (
                        <p className="text-xs text-muted-foreground">{res.guestEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs font-semibold text-[#3C216C]">
                        {res.bookingRef}
                      </p>
                    </td>
                    <td className="px-4 py-4 font-medium text-foreground">{res.roomNumber}</td>
                    <td className="px-4 py-4">
                      <p className="text-foreground">
                        {formatDate(res.checkInDate)} → {formatDate(res.checkOutDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">{res.numberOfNights} nights</p>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-elevation-1 ${statusBadge(res.status)}`}
                      >
                        {formatStatus(res.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${paymentBadge(res.paymentStatus)}`}
                      >
                        {formatPaymentStatus(res.paymentStatus)}
                      </span>
                      {res.balanceDue > 0 && (
                        <p className="mt-1 text-xs text-amber-700">₵{res.balanceDue} due</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ${sourceBadge(res.source)}`}
                      >
                        {formatStatus(res.source)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-semibold text-foreground">₵{res.totalPrice}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <ChevronRight className="mx-auto h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalItems > 0 && (
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

      {selected && (
        <ReservationDrawer
          reservation={selected}
          roomOptions={roomOptions}
          staffRole={staffRole}
          onlinePaymentsEnabled={onlinePaymentsEnabled}
          initialExtendStay={initialExtendStay && selected.id === openReservationId}
          initialExtendDate={selected.id === openReservationId ? initialExtendDate : undefined}
          guestRequestId={selected.id === openReservationId ? activeGuestRequestId : null}
          onClose={() => {
            setSelectedId(null)
            clearReservationDeepLink(true)
          }}
          onMutated={() => {
            setSelectedId(null)
            clearReservationDeepLink(true)
            router.refresh()
          }}
          onGuestRequestHandled={() => {
            setActiveGuestRequestId(null)
            clearReservationDeepLink(true)
          }}
          onCheckoutInvoice={openStayInvoice}
        />
      )}

      {checkoutInvoice && (
        <CheckoutInvoiceDialog
          invoiceId={checkoutInvoice.id}
          guestName={checkoutInvoice.guestName}
          initialInvoice={checkoutInvoice.preview}
          reservationId={checkoutInvoice.reservationId}
          mode={checkoutInvoice.mode}
          onClose={() => {
            setCheckoutInvoice(null)
            setSelectedId(null)
            router.refresh()
          }}
          onSettled={() => {
            router.refresh()
          }}
        />
      )}

      {creating && (
        <ReservationFormModal
          roomOptions={roomOptions}
          occupancySpans={occupancySpans}
          staffRole={staffRole}
          initialFlowMode={initialNewFlow === 'check_in' ? 'check_in_now' : 'book_later'}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false)
            router.refresh()
          }}
          onCheckoutInvoice={openStayInvoice}
        />
      )}
    </>
  )
}

function formatDate(value: string) {
  return new Date(value + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function DiscountFields({
  type,
  value,
  reason,
  stayTotal,
  onTypeChange,
  onValueChange,
  onReasonChange,
}: {
  type: DiscountType
  value: string
  reason: string
  stayTotal: number
  onTypeChange: (type: DiscountType) => void
  onValueChange: (value: string) => void
  onReasonChange: (reason: string) => void
}) {
  const computed = computeDiscountAmount(stayTotal, type, Number(value || 0))
  return (
    <div className="space-y-2 rounded-xl surface-inset p-3">
      <p className="text-xs font-medium text-muted-foreground">Guest discount (before tax)</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value as DiscountType)}
          className={APP_FIELD_CLASS}
        >
          <option value="none">No discount</option>
          <option value="percent">Percent %</option>
          <option value="fixed">Fixed ₵</option>
        </select>
        <input
          type="number"
          min={0}
          max={type === 'percent' ? 100 : undefined}
          step="0.01"
          disabled={type === 'none'}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={type === 'percent' ? 'e.g. 10' : 'e.g. 50'}
          className={APP_FIELD_CLASS}
        />
      </div>
      {type !== 'none' && (
        <>
          <input
            type="text"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={200}
            className={APP_FIELD_CLASS}
          />
          <p className="text-xs text-muted-foreground">
            Applies ₵{computed.toLocaleString()} off the stay base
            {stayTotal > 0 ? ` (of ₵${stayTotal.toLocaleString()})` : ''}.
          </p>
        </>
      )}
    </div>
  )
}

interface ReservationDrawerProps {
  reservation: Reservation
  roomOptions: RoomOption[]
  staffRole: UserRole
  onlinePaymentsEnabled?: boolean
  initialExtendStay?: boolean
  initialExtendDate?: string
  guestRequestId?: string | null
  onClose: () => void
  onMutated: () => void
  onCheckoutInvoice?: (
    invoiceId: string,
    guestName: string,
    preview?: InvoiceExportRow,
    options?: { reservationId?: string; mode?: 'view' | 'collect' },
  ) => void
  onGuestRequestHandled?: () => void
}

const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'mtn_momo',
  'telecel_cash',
  'airteltigo',
  'visa',
  'mastercard',
  'bank_transfer',
]

function ReservationDrawer({
  reservation,
  roomOptions,
  staffRole,
  onlinePaymentsEnabled = false,
  initialExtendStay = false,
  initialExtendDate,
  guestRequestId,
  onClose,
  onMutated,
  onCheckoutInvoice,
  onGuestRequestHandled,
}: ReservationDrawerProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [editing, setEditing] = useState(false)
  const [extending, setExtending] = useState(false)
  const [moving, setMoving] = useState(false)
  const [voidDialog, setVoidDialog] = useState<'cancel' | 'no_show' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [depositAmount, setDepositAmount] = useState('')
  const [recordingDeposit, setRecordingDeposit] = useState(false)
  const [issuingInvoice, setIssuingInvoice] = useState(false)
  const [earlyCheckout, setEarlyCheckout] = useState(false)
  const [markAsPaid, setMarkAsPaid] = useState(true)
  const [includeTax, setIncludeTax] = useState(true)
  const [phone, setPhone] = useState(reservation.guestPhone)
  const [email, setEmail] = useState(reservation.guestEmail)
  const [ghanaCardNumber, setGhanaCardNumber] = useState('')
  const [guestName, setGuestName] = useState(reservation.guestName)
  const [editGuestName, setEditGuestName] = useState(reservation.guestName)
  const [editRoomId, setEditRoomId] = useState(reservation.roomId)
  const [editCheckIn, setEditCheckIn] = useState(reservation.checkInDate)
  const [editCheckOut, setEditCheckOut] = useState(reservation.checkOutDate)
  const [editChannel, setEditChannel] = useState<ReservationChannel>(reservation.channel)
  const [editRateType, setEditRateType] = useState<RateType>(reservation.rateType)
  const [editNightlyRate, setEditNightlyRate] = useState(String(reservation.nightlyRate))
  const [editWeeklyRate, setEditWeeklyRate] = useState(String(reservation.weeklyRate))
  const [editMonthlyRate, setEditMonthlyRate] = useState(String(reservation.monthlyRate))
  const [editDiscountType, setEditDiscountType] = useState<DiscountType>(
    reservation.discountType ?? 'none',
  )
  const [editDiscountValue, setEditDiscountValue] = useState(
    String(reservation.discountValue ?? 0),
  )
  const [editDiscountReason, setEditDiscountReason] = useState(
    reservation.discountReason ?? '',
  )
  const [issueDiscountType, setIssueDiscountType] = useState<DiscountType>(
    reservation.discountType ?? 'none',
  )
  const [issueDiscountValue, setIssueDiscountValue] = useState(
    String(reservation.discountValue ?? 0),
  )
  const [issueDiscountReason, setIssueDiscountReason] = useState(
    reservation.discountReason ?? '',
  )
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [portalPin, setPortalPin] = useState<string | null>(null)
  const [newCheckOut, setNewCheckOut] = useState(initialExtendDate ?? reservation.checkOutDate)
  const [newRoomId, setNewRoomId] = useState(reservation.roomId)

  useEffect(() => {
    if (!initialExtendDate) return
    setNewCheckOut(initialExtendDate)
  }, [initialExtendDate])

  useEffect(() => {
    if (initialExtendStay) {
      setExtending(true)
    }
  }, [initialExtendStay])

  function run(
    action: () => Promise<{
      success: boolean
      error?: string
      invoiceId?: string
      invoicePreview?: InvoiceExportRow
    }>,
    onSuccess?: () => void,
  ) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        if (result.invoiceId && onCheckoutInvoice) {
          toast.success('Checked out')
          setCheckingOut(false)
          onCheckoutInvoice(result.invoiceId, reservation.guestName, result.invoicePreview, {
            reservationId: reservation.id,
            mode: 'view',
          })
        } else {
          toast.success('Saved')
          if (onSuccess) onSuccess()
          else onMutated()
        }
      } else {
        setError(result.error ?? 'Something went wrong.')
        toast.error(result.error ?? 'Something went wrong.')
      }
    })
  }

  function submitExtension() {
    setError(null)
    startTransition(async () => {
      const result = await extendStay(reservation.id, newCheckOut)
      if (!result.success) {
        setError(result.error ?? 'Something went wrong.')
        toast.error(result.error ?? 'Something went wrong.')
        return
      }

      toast.success(
        guestRequestId
          ? 'Stay extended. Mark the guest request as completed.'
          : 'Stay extended.',
      )
      setExtending(false)
      onMutated()
      if (guestRequestId) onGuestRequestHandled?.()
    })
  }

  const balance = reservation.balanceDue
  const hasCollectedDeposit = reservation.paidAmount > 0.009
  const canRefundDeposit = staffRole === 'owner'
  const canDiscount = canApplyGuestDiscount(staffRole)
  const canOmitTax = canOmitInvoiceTax(staffRole)
  const canRecordDeposit =
    (reservation.status === 'confirmed' ||
      reservation.status === 'checked_in' ||
      reservation.status === 'provisional') &&
    balance > 0
  const canMarkChannelPrepaid =
    canRecordDeposit &&
    (reservation.channel === 'airbnb' || reservation.channel === 'booking_com')
  const today = new Date().toISOString().slice(0, 10)
  const canNoShow =
    (reservation.status === 'confirmed' || reservation.status === 'pre_arrival') &&
    reservation.checkInDate <= today
  const canCancel = canCancelReservationStatus(reservation.status)
  const canEdit = canUpdateReservationFields(reservation.status)
  const canCheckInNow = canCheckIn(reservation.status)
  const lifecycleActions = getAvailableActions(reservation.status, staffRole)
  const canDisputeHold = lifecycleActions.includes('dispute_hold')
  const canReleaseNoShowRoom =
    lifecycleActions.includes('release_no_show_room') && Boolean(reservation.roomHeldUntil)
  const editDatesValid = editCheckOut > editCheckIn
  const editNights = Math.max(
    1,
    Math.round(
      (new Date(editCheckOut + 'T00:00:00').getTime() -
        new Date(editCheckIn + 'T00:00:00').getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  )
  const editTotal = calculateStayTotal(
    editRateType,
    editCheckIn,
    editCheckOut,
    Number(editNightlyRate || 0),
    Number(editMonthlyRate || 0),
    Number(editWeeklyRate || 0),
  )

  return (
    <CenteredModal
      open
      onClose={onClose}
      className="max-w-md overflow-hidden p-0"
      panelClassName="p-0"
      aria-label="Reservation details"
    >
      <div className="flex max-h-[90dvh] flex-col overflow-hidden bg-white">
        <div className="gradient-primary shrink-0 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-medium text-white/70">{reservation.bookingRef}</p>
              <h3 className="mt-1 text-xl font-bold inline-flex flex-wrap items-center gap-2">
                {reservation.guestName}
                {reservation.guestDoNotDisturb && <GuestDndBadge />}
              </h3>
              <p className="mt-1 text-sm text-white/80">Room {reservation.roomNumber}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(reservation.status)}`}
            >
              {formatStatus(reservation.status)}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${sourceBadge(reservation.source)}`}
            >
              {formatStatus(reservation.source)}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentBadge(reservation.paymentStatus)}`}
            >
              {formatPaymentStatus(reservation.paymentStatus)}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-inset rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Check-in
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(reservation.checkInDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div className="surface-inset rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Check-out
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(reservation.checkOutDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          <div className="surface-inset rounded-xl p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Payment</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {rateTypeLabel(reservation.rateType)} · {reservation.numberOfNights}n
                </span>
                <span className="font-bold text-foreground">₵{reservation.totalPrice}</span>
              </div>
              {(reservation.discountAmount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {reservation.discountReason
                      ? `Discount — ${reservation.discountReason}`
                      : 'Discount'}
                  </span>
                  <span className="font-semibold text-foreground">
                    -₵{reservation.discountAmount}
                  </span>
                </div>
              )}
              {reservation.folioSubtotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Folio (unbilled)</span>
                  <span className="font-semibold text-foreground">₵{reservation.folioSubtotal}</span>
                </div>
              )}
              {(reservation.folioSubtotal > 0 || (reservation.discountAmount ?? 0) > 0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated total</span>
                  <span className="font-bold text-foreground">₵{reservation.estimatedTotal}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-semibold text-foreground">₵{reservation.paidAmount}</span>
              </div>
              {balance > 0 && (
                <div className="flex justify-between border-t border-[#E9ECEF] pt-2">
                  <span className="font-medium text-amber-800">Outstanding</span>
                  <span className="font-bold text-amber-800">₵{balance}</span>
                </div>
              )}
              {reservation.paymentMethod && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Method: {PAYMENT_METHOD_LABELS[reservation.paymentMethod]}
                </p>
              )}
            </div>

            {(reservation.status === 'checked_in' ||
              reservation.status === 'overstay' ||
              reservation.status === 'checkout_in_progress') &&
              !issuingInvoice && (
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setIssuingInvoice(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  {reservation.invoiceId ? 'Refresh invoice & collect' : 'Issue invoice & collect'}
                </button>
                {reservation.invoiceId && onCheckoutInvoice && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      onCheckoutInvoice(reservation.invoiceId!, reservation.guestName, undefined, {
                        reservationId: reservation.id,
                        mode: balance > 0 ? 'collect' : 'view',
                      })
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1 disabled:opacity-50"
                  >
                    {balance > 0 ? 'Collect / view invoice' : 'View invoice'}
                  </button>
                )}
              </div>
            )}

            {issuingInvoice && (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {reservation.invoiceId
                    ? 'Refresh stay invoice with current folio, then optionally record payment.'
                    : 'Create a stay invoice now. Checkout will reuse this invoice (no duplicate).'}
                </p>
                {canDiscount && (
                  <DiscountFields
                    type={issueDiscountType}
                    value={issueDiscountValue}
                    reason={issueDiscountReason}
                    stayTotal={reservation.totalPrice}
                    onTypeChange={setIssueDiscountType}
                    onValueChange={setIssueDiscountValue}
                    onReasonChange={setIssueDiscountReason}
                  />
                )}
                <label className="block text-xs font-medium text-muted-foreground">
                  Payment method
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={markAsPaid}
                    onChange={(e) => setMarkAsPaid(e.target.checked)}
                  />
                  Guest paid full balance now
                </label>
                {canOmitTax ? (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={includeTax}
                      onChange={(e) => setIncludeTax(e.target.checked)}
                    />
                    Include Ghana tax
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    GRA tax (VAT &amp; levies) is included on every receptionist invoice.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setIssuingInvoice(false)}
                    className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setError(null)
                      startTransition(async () => {
                        const result = await issueStayInvoice({
                          reservationId: reservation.id,
                          paymentMethod,
                          markAsPaid,
                          includeTax: canOmitTax ? includeTax : true,
                          ...(canDiscount
                            ? {
                                discountType: issueDiscountType,
                                discountValue: Number(issueDiscountValue || 0),
                                discountReason: issueDiscountReason,
                              }
                            : {}),
                        })
                        if (!result.success) {
                          setError(result.error)
                          return
                        }
                        toast.success(
                          result.created
                            ? 'Invoice issued'
                            : markAsPaid
                              ? 'Payment recorded'
                              : 'Invoice refreshed',
                        )
                        setIssuingInvoice(false)
                        onMutated()
                        if (onCheckoutInvoice) {
                          onCheckoutInvoice(
                            result.invoiceId,
                            reservation.guestName,
                            result.invoicePreview,
                            {
                              reservationId: reservation.id,
                              mode: markAsPaid ? 'view' : 'collect',
                            },
                          )
                        }
                      })
                    }}
                    className="flex-[2] rounded-xl bg-[#D4A62E] py-2.5 text-sm font-semibold text-gray-900 disabled:opacity-50"
                  >
                    {pending ? 'Saving…' : markAsPaid ? 'Issue & mark paid' : 'Issue invoice'}
                  </button>
                </div>
              </div>
            )}

            {canRecordDeposit && !recordingDeposit && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRecordingDeposit(true)}
                  className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                >
                  Record deposit
                </button>
                {canMarkChannelPrepaid && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        markChannelPrepaid({
                          reservationId: reservation.id,
                          paymentMethod: 'bank_transfer',
                        }),
                      )
                    }
                    className="flex-1 rounded-xl bg-[#3C216C]/10 py-2.5 text-sm font-semibold text-[#3C216C] transition-all hover:bg-[#3C216C]/15 disabled:opacity-50"
                  >
                    Channel prepaid
                  </button>
                )}
              </div>
            )}

            {canRecordDeposit && recordingDeposit && (
              <div className="mt-4 space-y-3 border-t border-[#E9ECEF] pt-4">
                <FormField label={`Amount (max ₵${balance})`}>
                  <input
                    type="number"
                    min={0.01}
                    max={balance}
                    step={0.01}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className={APP_FIELD_CLASS}
                    placeholder="0.00"
                  />
                </FormField>
                <FormField label="Payment method">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className={APP_FIELD_CLASS}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setRecordingDeposit(false)
                      setDepositAmount('')
                    }}
                    className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-semibold text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending || !depositAmount || Number(depositAmount) <= 0}
                    onClick={() =>
                      run(
                        () =>
                          recordReservationDeposit({
                            reservationId: reservation.id,
                            amount: Number(depositAmount),
                            paymentMethod,
                          }),
                        () => {
                          setRecordingDeposit(false)
                          setDepositAmount('')
                        },
                      )
                    }
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Save deposit
                  </button>
                </div>
                {onlinePaymentsEnabled && (
                  <button
                    type="button"
                    disabled={pending || !depositAmount || Number(depositAmount) <= 0}
                    onClick={() => {
                      setError(null)
                      startTransition(async () => {
                        const result = await initiateStaffDepositPayment({
                          reservationId: reservation.id,
                          amount: Number(depositAmount),
                        })
                        if (!result.success) {
                          setError(result.error)
                          toast.error(result.error)
                          return
                        }
                        window.open(
                          result.data.authorizationUrl,
                          '_blank',
                          'noopener,noreferrer',
                        )
                        toast.success(
                          result.data.reused
                            ? 'Reopened existing deposit checkout'
                            : 'Deposit checkout link ready — complete on the guest device',
                        )
                        setRecordingDeposit(false)
                        setDepositAmount('')
                      })
                    }}
                    className="w-full rounded-xl border border-primary bg-primary/5 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    Pay deposit online
                  </button>
                )}
              </div>
            )}
          </div>

          {portalUrl && <PortalLinkPanel loginUrl={portalUrl} portalPin={portalPin} />}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
          )}

          {reservation.status !== 'checked_out' &&
            reservation.status !== 'post_stay' &&
            reservation.status !== 'archived' &&
            reservation.status !== 'cancelled' &&
            reservation.status !== 'no_show' &&
            reservation.status !== 'released' && (
            <div className="space-y-2">
              {canEdit && !checkingIn && !editing && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setEditing(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit reservation
                </button>
              )}

              {canEdit && editing && (
                <div className="space-y-3 rounded-xl surface-inset p-4">
                  <p className="text-sm font-semibold text-foreground">Edit reservation</p>
                  <FormField label="Guest name">
                    <input
                      value={editGuestName}
                      onChange={(e) => setEditGuestName(e.target.value)}
                      className={APP_FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Room">
                    <select
                      value={editRoomId}
                      onChange={(e) => {
                        const nextId = e.target.value
                        setEditRoomId(nextId)
                        const room = roomOptions.find((r) => r.id === nextId)
                        if (room) {
                          setEditNightlyRate(String(room.nightlyRate))
                          setEditWeeklyRate(String(room.weeklyRate))
                          setEditMonthlyRate(String(room.monthlyRate))
                        }
                      }}
                      className={APP_FIELD_CLASS}
                    >
                      {roomOptions.map((r) => (
                        <option key={r.id} value={r.id}>Room {r.number}</option>
                      ))}
                    </select>
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Check-in">
                      <input
                        type="date"
                        value={editCheckIn}
                        onChange={(e) => setEditCheckIn(e.target.value)}
                        className={APP_FIELD_CLASS}
                      />
                    </FormField>
                    <FormField label="Check-out">
                      <input
                        type="date"
                        value={editCheckOut}
                        onChange={(e) => setEditCheckOut(e.target.value)}
                        className={APP_FIELD_CLASS}
                      />
                    </FormField>
                  </div>
                  <FormField label="Channel">
                    <select
                      value={editChannel}
                      onChange={(e) => setEditChannel(e.target.value as ReservationChannel)}
                      className={APP_FIELD_CLASS}
                    >
                      {(Object.keys(CHANNEL_LABELS) as ReservationChannel[]).map((c) => (
                        <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Rate type">
                    <select
                      value={editRateType}
                      onChange={(e) => setEditRateType(e.target.value as RateType)}
                      className={APP_FIELD_CLASS}
                    >
                      <option value="nightly">Nightly</option>
                      <option value="weekly">Weekly (prorated)</option>
                      <option value="monthly">Monthly (prorated)</option>
                    </select>
                  </FormField>
                  {editRateType === 'nightly' ? (
                    <FormField label="Nightly rate (₵)">
                      <input
                        type="number"
                        min={0}
                        value={editNightlyRate}
                        onChange={(e) => setEditNightlyRate(e.target.value)}
                        className={APP_FIELD_CLASS}
                      />
                    </FormField>
                  ) : editRateType === 'weekly' ? (
                    <FormField label="Weekly rate (₵)">
                      <input
                        type="number"
                        min={0}
                        value={editWeeklyRate}
                        onChange={(e) => setEditWeeklyRate(e.target.value)}
                        className={APP_FIELD_CLASS}
                      />
                    </FormField>
                  ) : (
                    <FormField label="Monthly rate (₵)">
                      <input
                        type="number"
                        min={0}
                        value={editMonthlyRate}
                        onChange={(e) => setEditMonthlyRate(e.target.value)}
                        className={APP_FIELD_CLASS}
                      />
                    </FormField>
                  )}
                  {canDiscount && (
                    <DiscountFields
                      type={editDiscountType}
                      value={editDiscountValue}
                      reason={editDiscountReason}
                      stayTotal={editTotal}
                      onTypeChange={setEditDiscountType}
                      onValueChange={setEditDiscountValue}
                      onReasonChange={setEditDiscountReason}
                    />
                  )}
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm shadow-elevation-1">
                    <span className="text-muted-foreground">{editNights} nights</span>
                    <span className="font-bold">
                      ₵
                      {Math.max(
                        0,
                        editTotal -
                          (canDiscount
                            ? computeDiscountAmount(
                                editTotal,
                                editDiscountType,
                                Number(editDiscountValue || 0),
                              )
                            : Number(reservation.discountAmount ?? 0)),
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setEditing(false)}
                      className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold shadow-elevation-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={
                        pending ||
                        !editDatesValid ||
                        !editGuestName.trim() ||
                        (editRateType === 'weekly' && Number(editWeeklyRate) <= 0) ||
                        (editRateType === 'monthly' && Number(editMonthlyRate) <= 0)
                      }
                      onClick={() =>
                        run(
                          () =>
                            updateReservation(reservation.id, {
                              guestName: editGuestName,
                              roomId: editRoomId,
                              checkIn: editCheckIn,
                              checkOut: editCheckOut,
                              channel: editChannel,
                              rateType: editRateType,
                              nightlyRate: Number(editNightlyRate || 0),
                              weeklyRate: Number(editWeeklyRate || 0),
                              monthlyRate: Number(editMonthlyRate || 0),
                              ...(canDiscount
                                ? {
                                    discountType: editDiscountType,
                                    discountValue: Number(editDiscountValue || 0),
                                    discountReason: editDiscountReason,
                                  }
                                : {}),
                            }),
                          () => {
                            setEditing(false)
                            onMutated()
                          },
                        )
                      }
                      className="flex-[2] rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      {pending ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              )}

              {canCheckInNow && !checkingIn && !editing && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setCheckingIn(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A62E] py-3 text-sm font-semibold text-gray-900 shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  Check in guest
                </button>
              )}

              {canCheckInNow && checkingIn && (
                <div className="space-y-3 rounded-xl surface-inset p-4">
                  <p className="text-sm font-semibold text-foreground">Guest check-in</p>
                  <FormField label="Guest name">
                    <input value={guestName} onChange={(e) => {
                      setGuestName(e.target.value)
                      setSelectedGuestId(null)
                    }} className={APP_FIELD_CLASS} />
                  </FormField>
                  <FormField label="Phone (required)">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+233 XX XXX XXXX"
                      className={APP_FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Email (optional)">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={APP_FIELD_CLASS}
                    />
                  </FormField>
                  <FormField label="Ghana Card (tax ID, optional)">
                    <input
                      value={ghanaCardNumber}
                      onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
                      placeholder="GHA-728071939-8"
                      className={`${APP_FIELD_CLASS} uppercase`}
                    />
                  </FormField>
                  <GuestSearchField
                    label="Find returning guest"
                    selectedGuestId={selectedGuestId}
                    onSelectGuest={(g) => {
                      if (g) {
                        setSelectedGuestId(g.id)
                        setGuestName(g.name)
                        setPhone(g.phone ?? '')
                        setEmail(g.email ?? '')
                        setGhanaCardNumber(g.ghanaCardNumber ?? '')
                      } else {
                        setSelectedGuestId(null)
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setCheckingIn(false)}
                      className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={pending || !phone.trim() || !guestName.trim()}
                      onClick={() => {
                        setError(null)
                        startTransition(async () => {
                          const result = await checkInStay(reservation.id, {
                            phone,
                            email,
                            guestId: selectedGuestId ?? undefined,
                            guestName,
                            ghanaCardNumber,
                          })
                          if (result.success && result.data) {
                            setPortalUrl(result.data.loginUrl)
                            setPortalPin(result.data.portalPin)
                            setCheckingIn(false)
                            onMutated()
                            if (result.data.invoiceError) {
                              toast.error(
                                `Checked in, but invoice failed: ${result.data.invoiceError}`,
                              )
                            } else if (
                              result.data.invoiceId &&
                              result.data.invoicePreview &&
                              onCheckoutInvoice
                            ) {
                              toast.success('Checked in — collect payment at the desk')
                              onCheckoutInvoice(
                                result.data.invoiceId,
                                guestName,
                                result.data.invoicePreview,
                                { reservationId: reservation.id, mode: 'collect' },
                              )
                            } else {
                              toast.success('Checked in')
                            }
                          } else if (!result.success) {
                            setError(result.error ?? 'Check-in failed.')
                          }
                        })
                      }}
                      className="flex-[2] rounded-xl bg-[#D4A62E] py-2.5 text-sm font-semibold text-gray-900"
                    >
                      {pending ? 'Checking in…' : 'Complete check-in'}
                    </button>
                  </div>
                </div>
              )}

              {(reservation.status === 'checked_in' || reservation.status === 'overstay') &&
                !checkingOut &&
                !extending &&
                !moving && (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => beginCheckoutReservation(reservation.id),
                        () => {
                          onMutated()
                          setCheckingOut(true)
                        },
                      )
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Begin checkout
                  </button>
                  {reservation.status === 'overstay' && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => approveLateCheckoutReservation(reservation.id))
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 py-3 text-sm font-semibold text-amber-950 ring-1 ring-amber-200"
                    >
                      Approve late checkout
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setExtending(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-foreground shadow-elevation-1"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Extend stay
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setMoving(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-foreground shadow-elevation-1"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Move room
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Record walkout? Guest left without paying. An invoice with balance due will be created and the room released.',
                        )
                      ) {
                        return
                      }
                      run(() => recordWalkoutReservation(reservation.id, paymentMethod, earlyCheckout, canOmitTax ? includeTax : true))
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-800"
                  >
                    <UserX className="h-4 w-4" />
                    Record walkout
                  </button>
                  {canDisputeHold && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Start billing dispute hold? The guest stays in-house but checkout is paused until resolved.',
                          )
                        ) {
                          return
                        }
                        run(() => beginDisputeHold(reservation.id))
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-3 text-sm font-semibold text-amber-900"
                    >
                      Dispute hold
                    </button>
                  )}
                </>
              )}

              {reservation.status === 'dispute_hold' &&
                !checkingOut &&
                !extending &&
                !moving && (
                <>
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    Billing dispute hold — resolve the dispute before completing checkout.
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => beginCheckoutReservation(reservation.id),
                        () => {
                          onMutated()
                          setCheckingOut(true)
                        },
                      )
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1"
                  >
                    <LogOut className="h-4 w-4" />
                    Begin checkout
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Record walkout? Guest left without paying. An invoice with balance due will be created and the room released.',
                        )
                      ) {
                        return
                      }
                      run(() => recordWalkoutReservation(reservation.id, paymentMethod, earlyCheckout, canOmitTax ? includeTax : true))
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-800"
                  >
                    <UserX className="h-4 w-4" />
                    Record walkout
                  </button>
                </>
              )}

              {reservation.status === 'checkout_in_progress' && !checkingOut && !extending && !moving && (
                <>
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    Checkout in progress — folio is locked. Post any final charges before completing, or record a walkout if the guest left without paying.
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setCheckingOut(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1"
                  >
                    <LogOut className="h-4 w-4" />
                    Complete checkout
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          'Record walkout? Guest left without paying. An invoice with balance due will be created and the room released.',
                        )
                      ) {
                        return
                      }
                      run(() => recordWalkoutReservation(reservation.id, paymentMethod, earlyCheckout, canOmitTax ? includeTax : true))
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-800"
                  >
                    <UserX className="h-4 w-4" />
                    Record walkout
                  </button>
                </>
              )}

              {extending && (
                <div className="space-y-3 rounded-xl surface-inset p-4">
                  <p className="text-sm font-semibold">Extend stay</p>
                  {guestRequestId && (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      This extension came from a guest request. After saving the new date, go back and mark the request as completed.
                    </p>
                  )}
                  <FormField label="New check-out date">
                    <input
                      type="date"
                      value={newCheckOut}
                      min={reservation.checkOutDate}
                      onChange={(e) => setNewCheckOut(e.target.value)}
                      className={APP_FIELD_CLASS}
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setExtending(false)} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold shadow-elevation-1">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending || newCheckOut <= reservation.checkOutDate}
                      onClick={submitExtension}
                      className="flex-[2] rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      {pending ? 'Saving…' : 'Extend'}
                    </button>
                  </div>
                </div>
              )}

              {moving && (
                <div className="space-y-3 rounded-xl surface-inset p-4">
                  <p className="text-sm font-semibold">Move to another room</p>
                  <FormField label="New room">
                    <select value={newRoomId} onChange={(e) => setNewRoomId(e.target.value)} className={APP_FIELD_CLASS}>
                      {roomOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.number}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMoving(false)} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold shadow-elevation-1">
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pending || newRoomId === reservation.roomId}
                      onClick={() => run(() => moveStayRoom(reservation.id, newRoomId))}
                      className="flex-[2] rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      {pending ? 'Moving…' : 'Move guest'}
                    </button>
                  </div>
                </div>
              )}

              {reservation.status === 'checkout_in_progress' && checkingOut && (
                <div className="space-y-3 rounded-xl surface-inset p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {balance > 0 ? 'Collect remaining & check out' : 'Complete checkout'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {balance > 0
                        ? 'Stay was billed at check-in. Collect any unpaid folio balance, then release the room. Use Walkout if the guest left without paying.'
                        : 'Stay invoice already settled at check-in. Refresh folio if needed, then release the room.'}
                    </p>
                  </div>
                  {canOmitTax ? (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeTax}
                        onChange={(e) => setIncludeTax(e.target.checked)}
                      />
                      Include VAT &amp; GRA levies on invoice refresh
                    </label>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Invoice refresh includes GRA tax (VAT &amp; levies).
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={earlyCheckout}
                      onChange={(e) => setEarlyCheckout(e.target.checked)}
                    />
                    Early checkout (bill through today)
                  </label>
                  {balance > 0 && (
                    <>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className={APP_FIELD_CLASS}
                      >
                        {PAYMENT_METHODS.map((m) => (
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
                        Remaining balance received now (required unless walkout)
                      </label>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setCheckingOut(false)}
                      className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={pending || (balance > 0 && !markAsPaid)}
                      onClick={() =>
                        run(() =>
                          completeCheckoutReservation(
                            reservation.id,
                            paymentMethod,
                            earlyCheckout,
                            balance > 0 ? markAsPaid : true,
                            canOmitTax ? includeTax : true,
                          ),
                        )
                      }
                      className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#3C216C] py-2.5 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {pending ? 'Checking out…' : 'Confirm check-out'}
                    </button>
                  </div>
                </div>
              )}

              {!checkingOut && !checkingIn && !extending && !moving && !editing && (
                <>
                  {voidDialog && (
                    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-semibold text-amber-950">
                        ₵{reservation.paidAmount} deposit collected
                      </p>
                      <p className="text-xs text-amber-900">
                        Choose how to handle the deposit before{' '}
                        {voidDialog === 'cancel' ? 'cancelling' : 'marking no-show'}.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                voidDialog === 'cancel'
                                  ? cancelReservation(reservation.id, {
                                      depositDisposition: 'forfeit' as DepositDisposition,
                                    })
                                  : markNoShow(reservation.id, {
                                      depositDisposition: 'forfeit' as DepositDisposition,
                                    }),
                              () => setVoidDialog(null),
                            )
                          }
                          className="rounded-xl bg-white py-2.5 text-sm font-semibold text-foreground shadow-elevation-1"
                        >
                          Forfeit deposit (hotel keeps)
                        </button>
                        {canRefundDeposit ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () =>
                                  voidDialog === 'cancel'
                                    ? cancelReservation(reservation.id, {
                                        depositDisposition: 'refund' as DepositDisposition,
                                      })
                                    : markNoShow(reservation.id, {
                                        depositDisposition: 'refund' as DepositDisposition,
                                      }),
                                () => setVoidDialog(null),
                              )
                            }
                            className="rounded-xl bg-[#3C216C] py-2.5 text-sm font-semibold text-white"
                          >
                            Refund deposit
                          </button>
                        ) : (
                          <p className="text-center text-xs text-amber-800">
                            Refunds require the property owner.
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setVoidDialog(null)}
                          className="text-sm font-medium text-muted-foreground"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {!voidDialog && canNoShow ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (hasCollectedDeposit) {
                          setVoidDialog('no_show')
                          return
                        }
                        run(() => markNoShow(reservation.id))
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-50 py-3 text-sm font-semibold text-amber-800 shadow-elevation-1"
                    >
                      <UserX className="h-4 w-4" />
                      Mark no-show
                    </button>
                  ) : null}
                  {!voidDialog && canReleaseNoShowRoom ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Release the room hold? The room will become available for new bookings.',
                          )
                        ) {
                          return
                        }
                        run(() => releaseNoShowRoomHold(reservation.id))
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200"
                    >
                      Release room hold
                    </button>
                  ) : null}
                  {!voidDialog && canCancel ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (hasCollectedDeposit) {
                          setVoidDialog('cancel')
                          return
                        }
                        if (
                          !window.confirm(
                            'Cancel this reservation? This cannot be undone.',
                          )
                        ) {
                          return
                        }
                        run(() => cancelReservation(reservation.id))
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-red-600 shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel reservation
                    </button>
                  ) : null}
                  {reservation.status === 'checked_in' && (
                    <p className="text-center text-xs text-muted-foreground">
                      In-house guests must use Check out to settle payment and release the room.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </CenteredModal>
  )
}

interface ReservationFormModalProps {
  roomOptions: RoomOption[]
  occupancySpans: OccupancySpan[]
  staffRole: UserRole
  initialFlowMode?: 'book_later' | 'check_in_now'
  onClose: () => void
  onDone: () => void
  onCheckoutInvoice?: (
    invoiceId: string,
    guestName: string,
    preview?: InvoiceExportRow,
    options?: { reservationId?: string; mode?: 'view' | 'collect' },
  ) => void
}

function ReservationFormModal({
  roomOptions,
  occupancySpans,
  staffRole,
  initialFlowMode = 'book_later',
  onClose,
  onDone,
  onCheckoutInvoice,
}: ReservationFormModalProps) {
  const canDiscount = canApplyGuestDiscount(staffRole)
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [flowMode, setFlowMode] = useState<'book_later' | 'check_in_now'>(initialFlowMode)
  const [guestName, setGuestName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ghanaCardNumber, setGhanaCardNumber] = useState('')
  const [roomId, setRoomId] = useState(roomOptions[0]?.id ?? '')
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(tomorrow)
  const [channel, setChannel] = useState<ReservationChannel>(
    flowMode === 'check_in_now' ? 'walk_in' : 'direct',
  )
  const [rateType, setRateType] = useState<RateType>('nightly')
  const [nightlyRate, setNightlyRate] = useState(String(roomOptions[0]?.nightlyRate ?? 0))
  const [weeklyRate, setWeeklyRate] = useState(String(roomOptions[0]?.weeklyRate ?? 0))
  const [monthlyRate, setMonthlyRate] = useState(String(roomOptions[0]?.monthlyRate ?? 0))
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState('0')
  const [discountReason, setDiscountReason] = useState('')
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [portalPin, setPortalPin] = useState<string | null>(null)
  const [checkInInvoice, setCheckInInvoice] = useState<{
    id: string
    reservationId: string
    preview?: InvoiceExportRow
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const room = roomOptions.find((r) => r.id === roomId)
    if (room) {
      setNightlyRate(String(room.nightlyRate))
      setWeeklyRate(String(room.weeklyRate))
      setMonthlyRate(String(room.monthlyRate))
    }
  }, [roomId, roomOptions])

  useEffect(() => {
    if (flowMode === 'check_in_now') {
      setChannel('walk_in')
      setCheckIn(today)
    }
  }, [flowMode, today])

  const datesValid = checkOut > checkIn

  const occupiedRoomIds = useMemo(() => {
    const set = new Set<string>()
    if (!datesValid) return set
    for (const span of occupancySpans) {
      if (!span.roomId) continue
      const overlaps = span.checkIn < checkOut && span.checkOut > checkIn
      if (overlaps) set.add(span.roomId)
    }
    return set
  }, [occupancySpans, checkIn, checkOut, datesValid])

  const availableRooms = useMemo(
    () => roomOptions.filter((r) => !occupiedRoomIds.has(r.id)),
    [roomOptions, occupiedRoomIds],
  )

  const selectedRoomClashes = datesValid && occupiedRoomIds.has(roomId)
  const suggestions = availableRooms.slice(0, 5)

  const nights = Math.max(
    1,
    Math.round(
      (new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  )
  const total = calculateStayTotal(
    rateType,
    checkIn,
    checkOut,
    Number(nightlyRate || 0),
    Number(monthlyRate || 0),
    Number(weeklyRate || 0),
  )

  function submit() {
    setError(null)
    startTransition(async () => {
      const basePayload = {
        guestName,
        roomId,
        checkIn,
        checkOut,
        channel,
        rateType,
        nightlyRate: Number(nightlyRate || 0),
        weeklyRate: Number(weeklyRate || 0),
        monthlyRate: Number(monthlyRate || 0),
        guestId: selectedGuestId ?? undefined,
        ...(canDiscount
          ? {
              discountType,
              discountValue: Number(discountValue || 0),
              discountReason,
            }
          : {}),
      }

      if (flowMode === 'check_in_now') {
        const result = await bookAndCheckIn({
          ...basePayload,
          phone: phone.trim(),
          email: email.trim() || undefined,
          ghanaCardNumber: ghanaCardNumber.trim() || undefined,
        })
        if (result.success) {
          setPortalUrl(result.data.loginUrl)
          setPortalPin(result.data.portalPin)
          if (result.data.invoiceError) {
            toast.error(`Checked in, but invoice failed: ${result.data.invoiceError}`)
          } else if (result.data.invoiceId) {
            setCheckInInvoice({
              id: result.data.invoiceId,
              reservationId: result.data.reservationId,
              preview: result.data.invoicePreview,
            })
            toast.success('Checked in — stay invoice ready; collect payment')
            if (onCheckoutInvoice) {
              onCheckoutInvoice(
                result.data.invoiceId,
                guestName.trim(),
                result.data.invoicePreview,
                {
                  reservationId: result.data.reservationId,
                  mode: 'collect',
                },
              )
            }
          } else {
            toast.success('Checked in')
          }
        } else {
          setError(result.error)
          if (result.suggestions && result.suggestions.length > 0) {
            setRoomId(result.suggestions[0].id)
          }
        }
        return
      }

      const result = await createReservation(basePayload)
      if (result.success) {
        onDone()
      } else {
        setError(result.error)
        if (result.suggestions && result.suggestions.length > 0) {
          setRoomId(result.suggestions[0].id)
        }
      }
    })
  }

  const canSubmit =
    roomOptions.length > 0 &&
    !selectedRoomClashes &&
    datesValid &&
    guestName.trim().length >= 2 &&
    (flowMode !== 'check_in_now' || phone.trim().length > 0) &&
    (rateType !== 'weekly' || Number(weeklyRate) > 0) &&
    (rateType !== 'monthly' || Number(monthlyRate) > 0)

  if (portalUrl) {
    return (
      <CenteredModal open onClose={onClose} aria-label="Guest checked in">
        <ModalHeader onClose={onDone}>
          <h3 className="text-lg font-semibold text-foreground">Guest checked in</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Payment is taken at check-in. Collect now, then share the portal link.
          </p>
        </ModalHeader>
        <ModalBody className="space-y-4">
          {checkInInvoice && onCheckoutInvoice && (
            <button
              type="button"
              onClick={() => {
                onCheckoutInvoice(checkInInvoice.id, guestName.trim(), checkInInvoice.preview, {
                  reservationId: checkInInvoice.reservationId,
                  mode: 'collect',
                })
                onDone()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A62E] py-3 text-sm font-semibold text-gray-900 shadow-elevation-1"
            >
              <Receipt className="h-4 w-4" />
              Collect payment
            </button>
          )}
          <PortalLinkPanel loginUrl={portalUrl} portalPin={portalPin} />
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1"
          >
            Done
          </button>
        </ModalFooter>
      </CenteredModal>
    )
  }

  return (
    <CenteredModal open onClose={onClose} className="max-w-lg" aria-label="New reservation">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">New reservation</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Book for a future stay or check a guest in now.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        <div className="rooms-view-toggle w-full" role="tablist" aria-label="Reservation flow">
          <button
            type="button"
            role="tab"
            aria-selected={flowMode === 'book_later'}
            onClick={() => setFlowMode('book_later')}
            className={`rooms-view-toggle__btn flex-1 justify-center py-2.5 ${
              flowMode === 'book_later' ? 'rooms-view-toggle__btn--active' : ''
            }`}
          >
            Book for later
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={flowMode === 'check_in_now'}
            onClick={() => setFlowMode('check_in_now')}
            className={`rooms-view-toggle__btn flex-1 justify-center py-2.5 ${
              flowMode === 'check_in_now' ? 'rooms-view-toggle__btn--active' : ''
            }`}
          >
            Check in now
          </button>
        </div>
        <FormField label="Guest name">
          <input
            value={guestName}
            onChange={(e) => {
              setGuestName(e.target.value)
              setSelectedGuestId(null)
            }}
            placeholder="Full name"
            className={APP_FIELD_CLASS}
          />
        </FormField>

        <GuestSearchField
          label="Find existing guest (optional)"
          selectedGuestId={selectedGuestId}
          onSelectGuest={(g) => {
            if (g) {
              setSelectedGuestId(g.id)
              setGuestName(g.name)
              setPhone(g.phone ?? '')
              setEmail(g.email ?? '')
              setGhanaCardNumber(g.ghanaCardNumber ?? '')
            } else {
              setSelectedGuestId(null)
            }
          }}
        />

        <FormField label="Room">
          {roomOptions.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              No rooms available. Add a room first.
            </p>
          ) : (
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={APP_FIELD_CLASS}
            >
              {roomOptions.map((room) => {
                const booked = occupiedRoomIds.has(room.id)
                return (
                  <option key={room.id} value={room.id}>
                    Room {room.number}
                    {booked ? ' · booked these dates' : ''}
                  </option>
                )
              })}
            </select>
          )}

          {selectedRoomClashes && (
            <div className="mt-2 rounded-xl bg-amber-50 px-3 py-3 text-sm">
              <p className="font-semibold text-amber-800">
                This room is already booked for these dates.
              </p>
              {suggestions.length > 0 ? (
                <>
                  <p className="mt-1 text-xs text-amber-700">Available rooms for this period:</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestions.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setRoomId(room.id)}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#3C216C] shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2"
                      >
                        Room {room.number}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs text-amber-700">
                  No other rooms are free in this period. Try different dates.
                </p>
              )}
            </div>
          )}
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Check-in">
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              disabled={flowMode === 'check_in_now'}
              className={APP_FIELD_CLASS}
            />
          </FormField>
          <FormField label="Check-out">
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        </div>

        {flowMode === 'check_in_now' && (
          <>
            <FormField label="Phone (required)">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233 XX XXX XXXX"
                className={APP_FIELD_CLASS}
              />
            </FormField>
            <FormField label="Email (optional)">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={APP_FIELD_CLASS}
              />
            </FormField>
            <FormField label="Ghana Card (tax ID, optional)">
              <input
                value={ghanaCardNumber}
                onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
                placeholder="GHA-728071939-8"
                className={`${APP_FIELD_CLASS} uppercase`}
              />
            </FormField>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Channel">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ReservationChannel)}
              disabled={flowMode === 'check_in_now'}
              className={APP_FIELD_CLASS}
            >
              {(Object.keys(CHANNEL_LABELS) as ReservationChannel[]).map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Rate type">
            <select
              value={rateType}
              onChange={(e) => setRateType(e.target.value as RateType)}
              className={APP_FIELD_CLASS}
            >
              <option value="nightly">Nightly</option>
              <option value="weekly">Weekly (prorated)</option>
              <option value="monthly">Monthly (prorated)</option>
            </select>
          </FormField>
        </div>

        {rateType === 'nightly' ? (
          <FormField label="Nightly rate (₵)">
            <input
              type="number"
              value={nightlyRate}
              onChange={(e) => setNightlyRate(e.target.value)}
              min={0}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        ) : rateType === 'weekly' ? (
          <FormField label="Weekly rate (₵)">
            <input
              type="number"
              value={weeklyRate}
              onChange={(e) => setWeeklyRate(e.target.value)}
              min={0}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        ) : (
          <FormField label="Monthly rate (₵)">
            <input
              type="number"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              min={0}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        )}

        {canDiscount && (
          <DiscountFields
            type={discountType}
            value={discountValue}
            reason={discountReason}
            stayTotal={total}
            onTypeChange={setDiscountType}
            onValueChange={setDiscountValue}
            onReasonChange={setDiscountReason}
          />
        )}

        <div className="flex items-center justify-between rounded-xl surface-inset px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {nights} night{nights > 1 ? 's' : ''} · {rateTypeLabel(rateType)}
          </span>
          <span className="font-bold text-foreground">
            ₵
            {Math.max(
              0,
              total -
                (canDiscount
                  ? computeDiscountAmount(total, discountType, Number(discountValue || 0))
                  : 0),
            ).toLocaleString()}
          </span>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>
        )}
      </ModalBody>

      <ModalFooter className="flex items-center justify-end gap-2">
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
          onClick={submit}
          disabled={pending || !canSubmit}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-50"
        >
          {pending
            ? flowMode === 'check_in_now'
              ? 'Checking in…'
              : 'Creating…'
            : flowMode === 'check_in_now'
              ? 'Book & check in'
              : 'Create reservation'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

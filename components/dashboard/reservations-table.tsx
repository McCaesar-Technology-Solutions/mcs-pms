'use client'

import { reservations } from '@/lib/mock-data'
import { useProperty } from '@/lib/property-context'
import { ChevronRight, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CenteredModal } from '@/components/ui/centered-modal'

const STATUS_FILTERS = ['all', 'checked_in', 'confirmed', 'pending', 'checked_out'] as const

function formatStatus(status: string) {
  if (status === 'checked_in') return 'Checked In'
  if (status === 'checked_out') return 'Checked Out'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatSource(source: string) {
  return source.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ReservationsTable() {
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const { activePropertyId } = useProperty()

  const propertyReservations = useMemo(
    () => reservations.filter((r) => r.propertyId === activePropertyId),
    [activePropertyId],
  )

  const filteredReservations = useMemo(() => {
    return propertyReservations.filter((res) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !q ||
        res.guestName.toLowerCase().includes(q) ||
        res.guestEmail.toLowerCase().includes(q) ||
        res.bookingRef.toLowerCase().includes(q) ||
        res.roomNumber.includes(q)
      const matchesStatus = statusFilter === 'all' || res.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [propertyReservations, searchQuery, statusFilter])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-[#D4A62E] text-[#22124C]'
      case 'confirmed':
        return 'bg-[#3C216C] text-white'
      case 'pending':
        return 'bg-amber-100 text-amber-800'
      case 'checked_out':
        return 'bg-[#E9ECEF] text-[#5E5872]'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      website: 'bg-[#3C216C]/10 text-[#3C216C]',
      airbnb: 'bg-sky-50 text-sky-700',
      booking: 'bg-[#FAFDFF] text-[#3C216C] ring-1 ring-[#E9ECEF]',
      walk_in: 'bg-[#D4A62E]/15 text-[#B88D24]',
      other: 'bg-gray-50 text-gray-700',
    }
    return colors[source] || colors.other
  }

  const selected = selectedReservation
    ? propertyReservations.find((r) => r.id === selectedReservation)
    : null

  return (
    <>
      <div className="surface-card overflow-hidden">
        <div className="surface-card-accent" />

        <div className="surface-card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">All Reservations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredReservations.length} of {propertyReservations.length} reservations
            </p>
          </div>
        </div>

        <div className="surface-card-header space-y-4">
          <div className="flex items-center gap-3 rounded-xl surface-inset px-4 py-2.5">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search guest, ref, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground shadow-elevation-1'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {status === 'all' ? 'All' : formatStatus(status)}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 p-4 md:hidden">
          {filteredReservations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reservations match your filters.</p>
          ) : (
            filteredReservations.map((res) => (
              <button
                key={res.id}
                type="button"
                onClick={() => setSelectedReservation(res.id)}
                className={`elevated-list-item w-full p-4 text-left transition-colors ${
                  selectedReservation === res.id ? 'ring-2 ring-[#3C216C]/25' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{res.guestName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {res.bookingRef} · Room {res.roomNumber}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {new Date(res.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                  {new Date(res.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <span className="text-foreground"> · {res.numberOfNights}n</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(res.status)}`}>
                      {formatStatus(res.status)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getSourceBadge(res.source)}`}>
                      {formatSource(res.source)}
                    </span>
                  </div>
                  <span className="font-semibold text-foreground">₵{res.totalPrice}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Guest</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Reference</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Room</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Stay</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Status</th>
                <th className="px-4 py-4 text-left font-semibold text-foreground">Source</th>
                <th className="px-4 py-4 text-right font-semibold text-foreground">Amount</th>
                <th className="w-10 px-4 py-4 text-center font-semibold text-foreground" />
              </tr>
            </thead>
            <tbody>
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No reservations match your filters.
                  </td>
                </tr>
              ) : (
                filteredReservations.map((res) => (
                  <tr
                    key={res.id}
                    className={`cursor-pointer transition-colors ${
                      selectedReservation === res.id ? 'bg-[#3C216C]/6' : 'hover:bg-[#FAFDFF]'
                    }`}
                    onClick={() => setSelectedReservation(res.id)}
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground">{res.guestName}</p>
                      <p className="text-xs text-muted-foreground">{res.guestEmail}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-mono text-xs font-semibold text-[#3C216C]">{res.bookingRef}</p>
                    </td>
                    <td className="px-4 py-4 font-medium text-foreground">{res.roomNumber}</td>
                    <td className="px-4 py-4">
                      <p className="text-foreground">
                        {new Date(res.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} →{' '}
                        {new Date(res.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted-foreground">{res.numberOfNights} nights</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold shadow-elevation-1 ${getStatusBadge(res.status)}`}>
                        {formatStatus(res.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${getSourceBadge(res.source)}`}>
                        {formatSource(res.source)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-semibold text-foreground">₵{res.totalPrice}</p>
                      {res.paidAmount < res.totalPrice && (
                        <p className="text-xs text-amber-700">₵{res.totalPrice - res.paidAmount} due</p>
                      )}
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
      </div>

      {selected && (
        <ReservationDetailDrawer
          reservation={selected}
          onClose={() => setSelectedReservation(null)}
          getStatusBadge={getStatusBadge}
          getSourceBadge={getSourceBadge}
        />
      )}
    </>
  )
}

interface ReservationDetailDrawerProps {
  reservation: (typeof reservations)[0]
  onClose: () => void
  getStatusBadge: (status: string) => string
  getSourceBadge: (source: string) => string
}

function ReservationDetailDrawer({
  reservation,
  onClose,
  getStatusBadge,
  getSourceBadge,
}: ReservationDetailDrawerProps) {
  const balance = reservation.totalPrice - reservation.paidAmount

  return (
    <CenteredModal
      open
      onClose={onClose}
      className="max-w-md overflow-hidden p-0"
      panelClassName="p-0"
      aria-label="Reservation details"
    >
      <div className="flex flex-col overflow-hidden bg-white">
        <div className="gradient-primary px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-medium text-white/70">{reservation.bookingRef}</p>
              <h3 className="mt-1 text-xl font-bold">{reservation.guestName}</h3>
              <p className="mt-1 text-sm text-white/80">Room {reservation.roomNumber}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(reservation.status)}`}>
              {formatStatus(reservation.status)}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getSourceBadge(reservation.source)}`}>
              {formatSource(reservation.source)}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-inset rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Check-in</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(reservation.checkInDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="surface-inset rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Check-out</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {new Date(reservation.checkOutDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Guest</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate text-right font-medium text-foreground">{reservation.guestEmail}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium text-foreground">{reservation.guestPhone}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Nights</span>
                <span className="font-medium text-foreground">{reservation.numberOfNights}</span>
              </div>
            </div>
          </div>

          <div className="surface-inset rounded-xl p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Payment</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">₵{reservation.totalPrice}</span>
              </div>
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
            </div>
          </div>

          {reservation.notes && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Notes</p>
              <p className="surface-inset rounded-xl p-3 text-sm text-foreground">{reservation.notes}</p>
            </div>
          )}
        </div>
      </div>
    </CenteredModal>
  )
}

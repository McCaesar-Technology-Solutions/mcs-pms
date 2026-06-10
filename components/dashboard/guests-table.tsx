'use client'

import { useState } from 'react'
import { Search, Mail, Phone, BedDouble, CalendarDays } from 'lucide-react'
import { CenteredModal, ModalBody, ModalHeader } from '@/components/ui/centered-modal'
import type { GuestRow, GuestStatus } from '@/lib/data/guests'
import type { ReservationChannel } from '@/types'

interface GuestsTableProps {
  guests: GuestRow[]
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

export function GuestsTable({ guests }: GuestsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<GuestStatus | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null)

  const filteredGuests = guests.filter((guest) => {
    const matchesSearch =
      guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (guest.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (guest.phone ?? '').includes(searchQuery)
    const matchesStatus = !selectedStatus || guest.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  return (
    <>
      <div className="surface-card">
        <div className="surface-card-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Guest Directory</h2>
            <p className="text-sm text-muted-foreground mt-1">{filteredGuests.length} guests</p>
          </div>
        </div>

        <div className="surface-card-header space-y-4">
          <div className="flex items-center gap-3 surface-inset rounded-xl px-4 py-2.5">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedStatus(null)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                selectedStatus === null
                  ? 'bg-primary text-primary-foreground shadow-elevation-1'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              All Guests
            </button>
            {(['active', 'returning', 'vip', 'new'] as GuestStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedStatus === status
                    ? 'bg-primary text-primary-foreground shadow-elevation-1'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
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
          {filteredGuests.map((guest) => (
            <button
              key={guest.id}
              type="button"
              onClick={() => setSelectedGuest(guest)}
              className="elevated-list-item w-full p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{guest.name}</p>
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
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Guest Name</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Contact</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Source</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Stays</th>
                <th className="text-right py-4 px-6 font-semibold text-foreground">Total Spent</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredGuests.map((guest) => (
                <tr
                  key={guest.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedGuest(guest)}
                >
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground">{guest.name}</p>
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
      </div>

      <CenteredModal
        open={!!selectedGuest}
        onClose={() => setSelectedGuest(null)}
        className="max-w-lg"
        aria-label="Guest details"
      >
        {selectedGuest && (
          <>
            <ModalHeader onClose={() => setSelectedGuest(null)}>
              <h3 className="text-xl font-semibold">{selectedGuest.name}</h3>
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
                <h4 className="font-semibold">Contact Information</h4>
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

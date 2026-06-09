'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Mail, Phone, MapPin, MoreVertical, Plus, X } from 'lucide-react'

const MOCK_GUESTS = [
  {
    id: 1,
    name: 'Ama Mensah',
    email: 'ama.mensah@email.com',
    phone: '+233 24 123 4567',
    totalStays: 3,
    totalSpent: 4200,
    lastStay: '2026-05-28',
    status: 'returning',
    source: 'website',
    notes: 'Prefers room 302, business traveler',
    city: 'Accra',
  },
  {
    id: 2,
    name: 'Kwame Asante',
    email: 'kwame.a@email.com',
    phone: '+233 54 567 8901',
    totalStays: 1,
    totalSpent: 1200,
    lastStay: '2026-06-03',
    status: 'active',
    source: 'airbnb',
    notes: 'First time guest',
    city: 'Kumasi',
  },
  {
    id: 3,
    name: 'Abena Osei',
    email: 'abena.osei@email.com',
    phone: '+233 50 234 5678',
    totalStays: 5,
    totalSpent: 8900,
    lastStay: '2026-04-15',
    status: 'vip',
    source: 'booking',
    notes: 'VIP member, always leaves 5-star reviews',
    city: 'Takoradi',
  },
  {
    id: 4,
    name: 'Kofi Boateng',
    email: 'kofi.b@email.com',
    phone: '+233 55 345 6789',
    totalStays: 2,
    totalSpent: 2800,
    lastStay: '2026-05-10',
    status: 'returning',
    source: 'website',
    notes: 'Prefers high floor, ocean view',
    city: 'Accra',
  },
  {
    id: 5,
    name: 'Nana Acheampong',
    email: 'nana.a@email.com',
    phone: '+233 20 456 7890',
    totalStays: 1,
    totalSpent: 950,
    lastStay: '2026-06-01',
    status: 'active',
    source: 'walk-in',
    notes: 'Walk-in booking',
    city: 'Accra',
  },
]

export function GuestsTable() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<typeof MOCK_GUESTS[0] | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!selectedGuest) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedGuest(null)
    }

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedGuest])

  const filteredGuests = MOCK_GUESTS.filter((guest) => {
    const matchesSearch = guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.phone.includes(searchQuery)
    const matchesStatus = !selectedStatus || guest.status === selectedStatus
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vip':
        return 'bg-[#3C216C] text-white'
      case 'returning':
        return 'bg-blue-600 text-blue-50'
      case 'active':
        return 'bg-amber-600 text-amber-50'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'website':
        return 'bg-blue-100 text-blue-700'
      case 'airbnb':
        return 'bg-orange-100 text-orange-700'
      case 'booking':
        return 'bg-yellow-100 text-yellow-700'
      case 'walk-in':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <>
      <div className="surface-card">
        <div className="surface-card-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Guest Directory</h2>
            <p className="text-sm text-muted-foreground mt-1">{filteredGuests.length} guests</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold shadow-elevation-1 hover:shadow-elevation-2 transition-all hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            Add Guest
          </button>
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
            {['active', 'returning', 'vip'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  selectedStatus === status
                    ? 'bg-primary text-primary-foreground shadow-elevation-1'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

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
                  <p className="mt-0.5 text-xs text-muted-foreground">{guest.city}</p>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(guest.status)}`}>
                  {guest.status.charAt(0).toUpperCase() + guest.status.slice(1)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{guest.email}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getSourceColor(guest.source)}`}>
                  {guest.source.charAt(0).toUpperCase() + guest.source.slice(1)}
                </span>
                <span className="font-bold text-foreground">₵{guest.totalSpent}</span>
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
                <th className="text-center py-4 px-6 font-semibold text-foreground"></th>
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
                    <p className="text-xs text-muted-foreground mt-1">{guest.city}</p>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        {guest.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {guest.phone}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getSourceColor(guest.source)}`}>
                      {guest.source.charAt(0).toUpperCase() + guest.source.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <p className="font-bold text-foreground">{guest.totalStays}</p>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <p className="font-bold text-foreground">₵{guest.totalSpent}</p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(guest.status)} shadow-elevation-1`}>
                      {guest.status.charAt(0).toUpperCase() + guest.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedGuest &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close guest details"
              className="absolute inset-0 bg-[#22124C]/40 backdrop-blur-sm"
              onClick={() => setSelectedGuest(null)}
            />
            <div className="modal-panel surface-card relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-elevation-4">
              <div className="surface-card-header flex items-center justify-between">
                <h3 className="text-xl font-semibold">{selectedGuest.name}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedGuest(null)}
                  className="modal-panel-subtle rounded-lg p-1.5 transition-colors hover:bg-secondary/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
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
                      ₵{selectedGuest.totalSpent}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <Mail className="h-5 w-5 text-primary" />
                      <span className="text-sm">{selectedGuest.email}</span>
                    </div>
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <Phone className="h-5 w-5 text-primary" />
                      <span className="text-sm">{selectedGuest.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 surface-inset p-3 rounded-xl">
                      <MapPin className="h-5 w-5 text-primary" />
                      <span className="text-sm">{selectedGuest.city}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Booking Info</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="surface-inset p-3 rounded-xl">
                      <p className="modal-panel-subtle text-xs">Source</p>
                      <p className="text-sm font-semibold mt-1 capitalize">{selectedGuest.source}</p>
                    </div>
                    <div className="surface-inset p-3 rounded-xl">
                      <p className="modal-panel-subtle text-xs">Last Stay</p>
                      <p className="text-sm font-semibold mt-1">
                        {new Date(selectedGuest.lastStay).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Notes</h4>
                  <p className="modal-panel-subtle text-sm surface-inset p-3 rounded-xl">
                    {selectedGuest.notes}
                  </p>
                </div>
              </div>

              <div className="border-t border-[#E9ECEF] bg-[#FAFDFF]/80 px-6 py-4">
                <button
                  type="button"
                  className="gradient-primary w-full rounded-xl py-3 text-sm font-semibold text-white shadow-elevation-2 ring-1 ring-[#3C216C]/25 transition-all hover:-translate-y-0.5 hover:shadow-elevation-3"
                >
                  Edit Guest Profile
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

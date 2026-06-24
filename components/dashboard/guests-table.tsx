'use client'

import { useEffect, useState, useTransition } from 'react'
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
import { regenerateGuestAccess, revokeGuestAccess, checkOutGuest, updateGuest } from '@/app/actions/guest'
import { hasPhoneNumber } from '@/lib/phone'
import { toast } from 'sonner'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { PaymentMethod } from '@/types'
import type { GuestRow, GuestStatus } from '@/lib/data/guests'
import type { ReservationChannel } from '@/types'

interface GuestsTableProps {
  guests: GuestRow[]
  initialSearch?: string
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

export function GuestsTable({ guests, initialSearch = '', readOnly = false }: GuestsTableProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [selectedStatus, setSelectedStatus] = useState<GuestStatus | null>(null)
  const [selectedGuest, setSelectedGuest] = useState<GuestRow | null>(null)
  const [editingGuest, setEditingGuest] = useState(false)

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
                type="button"
                aria-pressed={selectedStatus === status}
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
                  onClick={() => {
                    setSelectedGuest(guest)
                    setEditingGuest(!readOnly && !hasPhoneNumber(guest.phone))
                  }}
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

  const url = token ? `${window.location.origin}/guest/enter?token=${token}` : ''
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

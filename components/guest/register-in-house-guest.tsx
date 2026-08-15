'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Receipt, UserPlus } from 'lucide-react'
import { enrollGuest, getEnrollmentRooms } from '@/app/actions/guest'
import { CheckoutInvoiceDialog } from '@/components/dashboard/checkout-invoice-dialog'
import { PortalLinkPanel } from '@/components/dashboard/portal-link-panel'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
import { BillToFields } from '@/components/dashboard/bill-to-fields'
import {
  GuestIdDocumentFields,
  useGuestIdDocumentFields,
} from '@/components/dashboard/guest-id-document-fields'
import type { InvoiceExportRow } from '@/lib/export/types'
import { toast } from 'sonner'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { calculateStayTotal, type RateType } from '@/lib/pricing/stay-totals'
import { phoneSchema, whatsAppHref } from '@/lib/phone'

type EnrollRoom = {
  id: string
  number: string
  nightlyRate: number
  weeklyRate: number
  monthlyRate: number
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function RegisterInHouseGuestCta() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="surface-card p-5">
        <div className="surface-card-accent" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Already in house?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Going live today — register guests who are already staying so they get portal access
              with their real arrival and departure dates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#3C216C] px-5 py-2.5 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2"
          >
            <UserPlus className="h-4 w-4" />
            Register in-house guest
          </button>
        </div>
      </div>
      {open && <RegisterInHouseGuestModal onClose={() => setOpen(false)} />}
    </>
  )
}

function RegisterInHouseGuestModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const today = todayISO()
  const [pending, startTransition] = useTransition()

  const [rooms, setRooms] = useState<EnrollRoom[]>([])
  const [occupied, setOccupied] = useState<{ roomId: string; checkIn: string; checkOut: string }[]>(
    [],
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const idFields = useGuestIdDocumentFields()
  const [includeTax, setIncludeTax] = useState(false)
  const [billToSameAsGuest, setBillToSameAsGuest] = useState(true)
  const [billToName, setBillToName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [checkIn, setCheckIn] = useState(today)
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 1))
  const [rateType, setRateType] = useState<RateType>('nightly')
  const [nightlyRate, setNightlyRate] = useState('')
  const [weeklyRate, setWeeklyRate] = useState('')
  const [monthlyRate, setMonthlyRate] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [result, setResult] = useState<{
    loginUrl: string
    portalPin: string
    phone: string
    reservationId: string
    invoiceId: string | null
    invoicePreview?: InvoiceExportRow
  } | null>(null)
  const [collectInvoice, setCollectInvoice] = useState<{
    id: string
    reservationId: string
    preview?: InvoiceExportRow
  } | null>(null)

  function applyRoomRates(room: EnrollRoom | undefined) {
    if (!room) return
    setNightlyRate(String(room.nightlyRate))
    setWeeklyRate(String(room.weeklyRate))
    setMonthlyRate(String(room.monthlyRate))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getEnrollmentRooms()
      if (cancelled) return
      if (!res.success || !res.data) {
        setLoadError(res.success ? 'Could not load rooms.' : res.error)
        return
      }
      setRooms(res.data.rooms)
      setOccupied(res.data.stays)
      const first = res.data.rooms[0]
      if (first) {
        setRoomId(first.id)
        applyRoomRates(first)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const occupiedRoomIds = useMemo(() => {
    const set = new Set<string>()
    if (checkOut <= checkIn) return set
    for (const span of occupied) {
      const overlaps = span.checkIn < checkOut && span.checkOut > checkIn
      if (overlaps) set.add(span.roomId)
    }
    return set
  }, [occupied, checkIn, checkOut])

  const availableRooms = useMemo(
    () => rooms.filter((r) => !occupiedRoomIds.has(r.id)),
    [rooms, occupiedRoomIds],
  )

  useEffect(() => {
    if (!roomId || occupiedRoomIds.has(roomId)) {
      const next = availableRooms[0]
      setRoomId(next?.id ?? '')
      applyRoomRates(next)
    }
  }, [availableRooms, occupiedRoomIds, roomId])

  const roomClash = Boolean(roomId) && occupiedRoomIds.has(roomId)
  const datesValid = checkOut > checkIn && checkIn <= today && checkOut > today
  const phoneValid = phoneSchema.safeParse(phone.trim()).success

  const total = calculateStayTotal(
    rateType,
    checkIn,
    checkOut,
    Number(nightlyRate || 0),
    Number(monthlyRate || 0),
    Number(weeklyRate || 0),
  )

  function onRoomChange(nextId: string) {
    setRoomId(nextId)
    applyRoomRates(rooms.find((r) => r.id === nextId))
  }

  function submit() {
    setError(null)
    const phoneParsed = phoneSchema.safeParse(phone.trim())
    if (!phoneParsed.success) {
      setError(phoneParsed.error.issues[0]?.message ?? 'Enter a valid phone number.')
      return
    }

    startTransition(async () => {
      const res = await enrollGuest({
        name: name.trim(),
        phone: phoneParsed.data,
        email: email.trim() || undefined,
        ...idFields.payload,
        roomId,
        checkIn,
        checkOut,
        rateType,
        nightlyRate: Number(nightlyRate || 0),
        weeklyRate: Number(weeklyRate || 0),
        monthlyRate: Number(monthlyRate || 0),
        includeTax,
        billToSameAsGuest,
        billToName: billToSameAsGuest ? undefined : billToName,
      })
      if (!res.success) {
        setError(res.error)
        if (res.suggestions?.[0]) {
          onRoomChange(res.suggestions[0].id)
        }
        return
      }
      setResult({
        loginUrl: res.data.loginUrl,
        portalPin: res.data.portalPin,
        phone: phoneParsed.data,
        reservationId: res.data.reservationId,
        invoiceId: res.data.invoiceId,
        invoicePreview: res.data.invoicePreview,
      })
      if (res.data.invoiceError) {
        toast.error(`Registered, but invoice failed: ${res.data.invoiceError}`)
      } else if (res.data.invoiceId) {
        toast.success('Registered — collect payment at the desk')
      }
      router.refresh()
    })
  }

  const canSubmit =
    !pending &&
    !loadError &&
    rooms.length > 0 &&
    Boolean(roomId) &&
    !roomClash &&
    datesValid &&
    name.trim().length >= 2 &&
    phoneValid &&
    (rateType !== 'weekly' || Number(weeklyRate) > 0) &&
    (rateType !== 'monthly' || Number(monthlyRate) > 0) &&
    (billToSameAsGuest || billToName.trim().length >= 2)

  if (result) {
    const waMessage = `Hi ${name.trim() || 'there'}, here is your guest portal link: ${result.loginUrl}. Or scan the property QR and use room PIN ${result.portalPin}.`
    const waHref =
      whatsAppHref(result.phone, waMessage) ||
      `https://wa.me/?text=${encodeURIComponent(waMessage)}`

    return (
      <>
        <CenteredModal open onClose={onClose} aria-label="Guest registered">
          <ModalHeader onClose={onClose}>
            <h3 className="text-lg font-semibold text-foreground">Guest registered</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Payment is taken at check-in. Collect now, then share the portal link or PIN. No
              automatic SMS was sent.
            </p>
          </ModalHeader>
          <ModalBody className="space-y-4">
            {result.invoiceId && (
              <button
                type="button"
                onClick={() =>
                  setCollectInvoice({
                    id: result.invoiceId!,
                    reservationId: result.reservationId,
                    preview: result.invoicePreview,
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4A62E] py-3 text-sm font-semibold text-gray-900 shadow-elevation-1"
              >
                <Receipt className="h-4 w-4" />
                Collect payment
              </button>
            )}
            <PortalLinkPanel loginUrl={result.loginUrl} portalPin={result.portalPin} />
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Send via WhatsApp
            </a>
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Done
            </button>
          </ModalFooter>
        </CenteredModal>
        {collectInvoice && (
          <CheckoutInvoiceDialog
            invoiceId={collectInvoice.id}
            guestName={name.trim()}
            initialInvoice={collectInvoice.preview}
            reservationId={collectInvoice.reservationId}
            mode="collect"
            onClose={() => setCollectInvoice(null)}
            onSettled={() => router.refresh()}
          />
        )}
      </>
    )
  }

  return (
    <CenteredModal open onClose={onClose} className="max-w-lg" aria-label="Register in-house guest">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Register in-house guest</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Use their real arrival date — not today&apos;s check-in — so nights and the folio stay
          correct.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        <FormField label="Guest name" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className={APP_FIELD_CLASS}
          />
        </FormField>

        <FormField label="Phone" required hint="Used for WhatsApp and contact">
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

        <GuestIdDocumentFields
          state={idFields.state}
          onChange={idFields.setState}
          allowNone
        />

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={includeTax}
            onChange={(e) => setIncludeTax(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Include Ghana tax on stay invoice
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Optional — VAT &amp; GRA levies. Leave unchecked for an untaxed invoice.
            </span>
          </span>
        </label>

        <BillToFields
          guestName={name}
          sameAsGuest={billToSameAsGuest}
          onSameAsGuestChange={setBillToSameAsGuest}
          billToName={billToName}
          onBillToNameChange={setBillToName}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Arrived" required hint="Can be in the past">
            <input
              type="date"
              value={checkIn}
              max={today}
              onChange={(e) => setCheckIn(e.target.value)}
              className={APP_FIELD_CLASS}
            />
          </FormField>
          <FormField label="Departs" required hint="Must be after today">
            <input
              type="date"
              value={checkOut}
              min={addDaysISO(today, 1)}
              onChange={(e) => setCheckOut(e.target.value)}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        </div>

        <FormField label="Room" required>
          <select
            value={roomId}
            onChange={(e) => onRoomChange(e.target.value)}
            className={APP_FIELD_CLASS}
          >
            {availableRooms.length === 0 && <option value="">No free rooms for these dates</option>}
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number}
              </option>
            ))}
          </select>
        </FormField>

        {roomClash && (
          <p className="text-sm text-destructive">
            That room already has a stay overlapping these dates.
          </p>
        )}

        <FormField label="Rate type">
          <select
            value={rateType}
            onChange={(e) => setRateType(e.target.value as RateType)}
            className={APP_FIELD_CLASS}
          >
            <option value="nightly">Nightly</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </FormField>

        {rateType === 'nightly' && (
          <FormField label="Nightly rate (GHS)" hint="Prefills from the room; edit if needed">
            <input
              type="number"
              min={0}
              step="0.01"
              value={nightlyRate}
              onChange={(e) => setNightlyRate(e.target.value)}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        )}
        {rateType === 'weekly' && (
          <FormField label="Weekly rate (GHS)" required>
            <input
              type="number"
              min={0}
              step="0.01"
              value={weeklyRate}
              onChange={(e) => setWeeklyRate(e.target.value)}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        )}
        {rateType === 'monthly' && (
          <FormField label="Monthly rate (GHS)" required>
            <input
              type="number"
              min={0}
              step="0.01"
              value={monthlyRate}
              onChange={(e) => setMonthlyRate(e.target.value)}
              className={APP_FIELD_CLASS}
            />
          </FormField>
        )}

        {datesValid && (
          <p className="text-xs text-muted-foreground">
            Stay total (before tax): GHS {total.toFixed(2)}. Balance starts unpaid — record any
            money already collected in Billing.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-xl bg-[#3C216C] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Registering…' : 'Register guest'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

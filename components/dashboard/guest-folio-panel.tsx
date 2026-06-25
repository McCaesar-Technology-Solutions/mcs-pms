'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { postGuestCharge, getGuestFolioCharges } from '@/app/actions/folio'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'

interface FolioCharge {
  id: string
  description: string
  amount: number
  charge_type: string
  created_at: string
  invoice_id: string | null
}

interface GuestFolioPanelProps {
  guestId: string
  guestName: string
  reservationId?: string | null
  readOnly?: boolean
  initialCharges?: FolioCharge[]
}

const CHARGE_TYPES = [
  { value: 'incidental', label: 'Incidental' },
  { value: 'room', label: 'Room charge' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'adjustment', label: 'Adjustment' },
] as const

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function GuestFolioPanel({
  guestId,
  guestName,
  reservationId,
  readOnly = false,
  initialCharges = [],
}: GuestFolioPanelProps) {
  const router = useRouter()
  const [charges, setCharges] = useState(initialCharges)
  const [adding, setAdding] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [chargeType, setChargeType] = useState<(typeof CHARGE_TYPES)[number]['value']>('incidental')
  const [pending, startTransition] = useTransition()

  const total = charges.reduce((sum, c) => sum + Number(c.amount), 0)
  const unbilled = charges.filter((c) => !c.invoice_id).reduce((sum, c) => sum + Number(c.amount), 0)

  useEffect(() => {
    startTransition(async () => {
      const rows = await getGuestFolioCharges(guestId)
      setCharges(rows as FolioCharge[])
    })
  }, [guestId])

  function refreshCharges() {
    startTransition(async () => {
      const rows = await getGuestFolioCharges(guestId)
      setCharges(rows as FolioCharge[])
    })
  }

  function submitCharge() {
    const amountNum = parseFloat(amount)
    if (!description.trim() || !amountNum || amountNum <= 0) {
      toast.error('Enter a description and valid amount.')
      return
    }

    startTransition(async () => {
      const result = await postGuestCharge({
        guestId,
        description: description.trim(),
        amount: amountNum,
        chargeType,
        reservationId: reservationId ?? undefined,
      })
      if (result.success) {
        toast.success('Charge posted to folio')
        setAdding(false)
        setDescription('')
        setAmount('')
        refreshCharges()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Guest folio</h4>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Post charge
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="surface-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Folio total</p>
          <p className="mt-1 text-lg font-bold">{money(total)}</p>
        </div>
        <div className="surface-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Unbilled</p>
          <p className="mt-1 text-lg font-bold text-amber-600">{money(unbilled)}</p>
        </div>
      </div>

      {charges.length === 0 ? (
        <p className="text-sm text-muted-foreground">No folio charges for {guestName} yet.</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto">
          {charges.map((charge) => (
            <li
              key={charge.id}
              className="flex items-center justify-between rounded-xl surface-inset px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{charge.description}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {charge.charge_type.replace(/_/g, ' ')}
                  {charge.invoice_id ? ' · invoiced' : ' · open'}
                </p>
              </div>
              <span className="font-semibold">{money(Number(charge.amount))}</span>
            </li>
          ))}
        </ul>
      )}

      <CenteredModal open={adding} onClose={() => setAdding(false)} className="max-w-sm" aria-label="Post folio charge">
        <ModalHeader onClose={() => setAdding(false)}>
          <h3 className="text-lg font-semibold">Post charge</h3>
          <p className="text-sm text-muted-foreground">{guestName}</p>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <div>
            <label className="text-sm font-semibold">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
              placeholder="e.g. Minibar, laundry"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Amount (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Type</label>
            <select
              value={chargeType}
              onChange={(e) => setChargeType(e.target.value as typeof chargeType)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
            >
              {CHARGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            disabled={pending}
            onClick={submitCharge}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Posting…' : 'Post to folio'}
          </button>
        </ModalFooter>
      </CenteredModal>
    </div>
  )
}

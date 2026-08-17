'use client'

import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { PaymentMethod } from '@/types'

const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'mtn_momo',
  'telecel_cash',
  'airteltigo',
  'visa',
  'mastercard',
  'bank_transfer',
]

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface InvoicePaymentFormProps {
  balanceDue: number
  paymentAmount: string
  onPaymentAmountChange: (value: string) => void
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  disabled?: boolean
  amountLabel?: string
  requiredMinimum?: number
  minimumShortfall?: number
  showMinimumHints?: boolean
  policyLabel?: string
  channelPrepaid?: boolean
  /** Paid so far before this payment (for summary line). */
  paidSoFar?: number
  /** Show paid · this · remaining summary. */
  showSettlementSummary?: boolean
}

export function InvoicePaymentForm({
  balanceDue,
  paymentAmount,
  onPaymentAmountChange,
  paymentMethod,
  onPaymentMethodChange,
  disabled = false,
  amountLabel = 'Amount to collect now',
  requiredMinimum = 0,
  minimumShortfall = 0,
  showMinimumHints = false,
  policyLabel,
  channelPrepaid = false,
  paidSoFar = 0,
  showSettlementSummary = false,
}: InvoicePaymentFormProps) {
  const parsedAmount = parseFloat(paymentAmount)
  const thisPayment = Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0
  const remainingAfter =
    Math.round(Math.max(0, balanceDue - Math.min(thisPayment, balanceDue)) * 100) / 100

  return (
    <div className="space-y-3">
      {showMinimumHints && requiredMinimum > 0 && minimumShortfall > 0 && (
        <p className="text-xs text-amber-900/90">
          Check-in minimum: {money(requiredMinimum)}
          {policyLabel ? ` (${policyLabel})` : ''}. {money(minimumShortfall)} still required.
        </p>
      )}
      {showMinimumHints && channelPrepaid && (
        <p className="text-xs text-emerald-800">
          Channel deposit already meets the check-in minimum.
        </p>
      )}
      {showSettlementSummary && (
        <div className="rounded-lg bg-white/60 px-3 py-2 text-xs text-amber-950">
          <div className="flex justify-between gap-2">
            <span>Paid so far</span>
            <span className="font-semibold">{money(paidSoFar)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <span>This payment</span>
            <span className="font-semibold">{money(thisPayment)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-2">
            <span>Remaining after</span>
            <span className="font-semibold">{money(remainingAfter)}</span>
          </div>
        </div>
      )}
      <label className="block text-sm">
        <span className="text-muted-foreground">Payment method</span>
        <select
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as PaymentMethod)}
          disabled={disabled}
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m] ?? m}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">{amountLabel}</span>
        <input
          type="number"
          min={0}
          step={0.01}
          max={balanceDue}
          value={paymentAmount}
          onChange={(e) => onPaymentAmountChange(e.target.value)}
          disabled={disabled || balanceDue <= 0}
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
        />
      </label>
      {balanceDue > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPaymentAmountChange(balanceDue.toFixed(2))}
            className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-elevation-1"
          >
            Pay balance ({money(balanceDue)})
          </button>
          {showMinimumHints && requiredMinimum > 0 && minimumShortfall > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onPaymentAmountChange(Math.min(balanceDue, minimumShortfall).toFixed(2))
              }
              className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-elevation-1"
            >
              Pay minimum ({money(Math.min(balanceDue, minimumShortfall))})
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export { PAYMENT_METHODS }

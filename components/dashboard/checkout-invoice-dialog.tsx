'use client'

import { useEffect, useState, useTransition } from 'react'
import { Download, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
  getStaffInvoiceExport,
  issueStayInvoice,
  recordInvoicePayment,
} from '@/app/actions/invoices'
import { InvoiceWhatsAppShare } from '@/components/dashboard/invoice-whatsapp-share'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'
import { downloadInvoicePdf, printInvoicePdf } from '@/lib/export/invoice-pdf'
import { invoiceHasTaxBreakdown, PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
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

interface CheckoutInvoiceDialogProps {
  invoiceId: string
  guestName?: string
  initialInvoice?: InvoiceExportRow
  /** Override the default helper line. */
  description?: string
  /**
   * collect = pay-at-check-in settlement UI (method + paid-in-full).
   * view = print / share only (post-checkout or already paid).
   */
  mode?: 'view' | 'collect'
  /** When set, settlement uses issueStayInvoice (keeps stay + invoice in sync). */
  reservationId?: string
  onClose: () => void
  onSettled?: () => void
}

function money(value: number | null | undefined) {
  return `₵${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatMethod(method: string | null | undefined) {
  if (!method) return 'Unspecified'
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ')
}

function isPaidStatus(status: string | null | undefined) {
  return status === 'paid' || status === 'refunded'
}

export function CheckoutInvoiceDialog({
  invoiceId,
  guestName,
  initialInvoice,
  description,
  mode = 'view',
  reservationId,
  onClose,
  onSettled,
}: CheckoutInvoiceDialogProps) {
  const [loadingExport, setLoadingExport] = useState(!initialInvoice)
  const [error, setError] = useState<string | null>(null)
  const [hotel, setHotel] = useState<ExportHotelInfo | null>(null)
  const [invoice, setInvoice] = useState<InvoiceExportRow | null>(initialInvoice ?? null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    const method = initialInvoice?.paymentMethod as PaymentMethod | undefined
    return method && PAYMENT_METHODS.includes(method) ? method : 'cash'
  })
  const [markAsPaid, setMarkAsPaid] = useState(true)
  const [pending, startTransition] = useTransition()

  const alreadyPaid = isPaidStatus(invoice?.paymentStatus)
  const showCollect = mode === 'collect' && !alreadyPaid

  useEffect(() => {
    let cancelled = false
    setLoadingExport(true)
    if (!initialInvoice) setError(null)

    void getStaffInvoiceExport(invoiceId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        if (!initialInvoice) setError(result.error)
        setLoadingExport(false)
        return
      }
      setHotel(result.data.hotel)
      setInvoice(result.data.invoice)
      const method = result.data.invoice.paymentMethod as PaymentMethod | null
      if (method && PAYMENT_METHODS.includes(method)) {
        setPaymentMethod(method)
      }
      setLoadingExport(false)
    })

    return () => {
      cancelled = true
    }
  }, [invoiceId, initialInvoice])

  async function handleDownload() {
    if (!hotel || !invoice) {
      toast.error('Preparing invoice for download…')
      return
    }
    await downloadInvoicePdf(hotel, invoice)
    toast.success('Invoice downloaded')
  }

  async function handlePrint() {
    if (!hotel || !invoice) {
      toast.error('Preparing invoice for print…')
      return
    }
    await printInvoicePdf(hotel, invoice)
    toast.success('Opening print dialog…')
  }

  function handleCollect() {
    setError(null)
    startTransition(async () => {
      if (!markAsPaid) {
        toast.message('Checked in unpaid — collect before the guest uses the room when possible.')
        onClose()
        return
      }

      if (reservationId) {
        const result = await issueStayInvoice({
          reservationId,
          paymentMethod,
          markAsPaid: true,
          includeTax: true,
        })
        if (!result.success) {
          setError(result.error)
          return
        }
        if (result.invoicePreview) setInvoice(result.invoicePreview)
        toast.success('Payment recorded — stay invoice settled')
        onSettled?.()
        return
      }

      const result = await recordInvoicePayment(invoiceId, paymentMethod)
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success('Payment recorded')
      const refreshed = await getStaffInvoiceExport(invoiceId)
      if (refreshed.success) {
        setHotel(refreshed.data.hotel)
        setInvoice(refreshed.data.invoice)
      }
      onSettled?.()
    })
  }

  const showTax = invoice ? invoiceHasTaxBreakdown(invoice) : false
  const pdfReady = Boolean(hotel && invoice)

  return (
    <CenteredModal
      open
      onClose={() => !pending && onClose()}
      className="max-w-md"
      aria-label={showCollect ? 'Collect stay payment' : 'Guest invoice'}
    >
      <ModalHeader onClose={() => !pending && onClose()}>
        <h3 className="text-lg font-semibold">
          {showCollect ? 'Collect payment' : 'Guest invoice'}
        </h3>
        <p className="modal-panel-subtle text-sm">
          {description ??
            (showCollect
              ? `${guestName ?? invoice?.guestName ?? 'Guest'} — payment is taken at check-in.`
              : `${guestName ?? invoice?.guestName ?? 'Guest'} — print, download, or send via WhatsApp.`)}
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {loadingExport && !invoice && (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading invoice…
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {invoice && (
          <>
            <div className="rounded-xl surface-inset p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{invoice.guestName}</p>
                  {invoice.guestTaxId && (
                    <p className="text-sm text-muted-foreground">Tax ID: {invoice.guestTaxId}</p>
                  )}
                  {invoice.roomNumber && (
                    <p className="text-sm text-muted-foreground">Room {invoice.roomNumber}</p>
                  )}
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold capitalize text-primary">
                  {invoice.paymentStatus ?? 'pending'}
                </span>
              </div>

              {invoice.checkIn && invoice.checkOut && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {new Date(invoice.checkIn + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                  {' – '}
                  {new Date(invoice.checkOut + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {invoice.nights != null &&
                    ` · ${invoice.nights} night${invoice.nights === 1 ? '' : 's'}`}
                </p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accommodation</span>
                <span className="font-medium">
                  {money(
                    (invoice.discountAmount ?? 0) > 0
                      ? invoice.subtotal + (invoice.discountAmount ?? 0)
                      : invoice.subtotal,
                  )}
                </span>
              </div>
              {(invoice.discountAmount ?? 0) > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {invoice.discountReason
                        ? `Discount — ${invoice.discountReason}`
                        : 'Discount'}
                    </span>
                    <span className="font-medium">-{money(invoice.discountAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxable subtotal</span>
                    <span className="font-medium">{money(invoice.subtotal)}</span>
                  </div>
                </>
              )}
              {showTax && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NHIL + GETFund</span>
                    <span className="font-medium">
                      {money(invoice.nhil + invoice.getfund)}
                    </span>
                  </div>
                  {(invoice.covid > 0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">COVID-19 levy (historical)</span>
                      <span className="font-medium">{money(invoice.covid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">VAT</span>
                    <span className="font-medium">{money(invoice.vat)}</span>
                  </div>
                  {(invoice.elevy ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">E-Levy</span>
                      <span className="font-medium">{money(invoice.elevy)}</span>
                    </div>
                  )}
                  {(invoice.tourism ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tourism levy</span>
                      <span className="font-medium">{money(invoice.tourism)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{money(invoice.total)}</span>
              </div>
              {!showCollect && (
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Payment method</span>
                  <span className="font-medium">{formatMethod(invoice.paymentMethod)}</span>
                </div>
              )}
            </div>

            {showCollect && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <p className="text-sm font-semibold text-amber-950">Pay before enter</p>
                <label className="block text-sm">
                  <span className="text-muted-foreground">Payment method</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    disabled={pending}
                    className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m] ?? m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-start gap-2 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={markAsPaid}
                    onChange={(e) => setMarkAsPaid(e.target.checked)}
                    disabled={pending}
                    className="mt-0.5"
                  />
                  <span>
                    Paid in full now
                    <span className="mt-0.5 block text-xs text-amber-900/80">
                      Uncheck only for prepaid channels or manager-approved exceptions.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleCollect}
                  className="flex w-full items-center justify-center rounded-xl bg-[#D4A62E] py-3 text-sm font-semibold text-gray-900 disabled:opacity-50"
                >
                  {pending
                    ? 'Saving…'
                    : markAsPaid
                      ? 'Record payment'
                      : 'Continue without payment'}
                </button>
              </div>
            )}

            {(!showCollect || alreadyPaid) && (
              <div className="flex flex-col gap-2">
                {hotel && (
                  <div className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 p-3">
                    <InvoiceWhatsAppShare hotel={hotel} invoice={invoice} embedded />
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void handlePrint()}
                    disabled={!pdfReady && loadingExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    <Printer className="h-4 w-4" />
                    {pdfReady ? 'Print invoice' : 'Preparing…'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    disabled={!pdfReady && loadingExport}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {pdfReady ? 'Download PDF' : 'Preparing…'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1 disabled:opacity-50"
        >
          {showCollect ? 'Close' : 'Done'}
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

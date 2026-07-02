'use client'

import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { getStaffInvoiceExport } from '@/app/actions/invoices'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'
import { downloadInvoicePdf, printInvoicePdf } from '@/lib/export/invoice-pdf'
import { invoiceHasTaxBreakdown, PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'

interface CheckoutInvoiceDialogProps {
  invoiceId: string
  guestName?: string
  onClose: () => void
}

function money(value: number | null | undefined) {
  return `₵${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatMethod(method: string | null | undefined) {
  if (!method) return 'Unspecified'
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ')
}

export function CheckoutInvoiceDialog({ invoiceId, guestName, onClose }: CheckoutInvoiceDialogProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hotel, setHotel] = useState<ExportHotelInfo | null>(null)
  const [invoice, setInvoice] = useState<InvoiceExportRow | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void getStaffInvoiceExport(invoiceId).then((result) => {
      if (cancelled) return
      if (!result.success) {
        setError(result.error)
        setLoading(false)
        return
      }
      setHotel(result.data.hotel)
      setInvoice(result.data.invoice)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [invoiceId])

  function handleDownload() {
    if (!hotel || !invoice) return
    downloadInvoicePdf(hotel, invoice)
    toast.success('Invoice downloaded')
  }

  function handlePrint() {
    if (!hotel || !invoice) return
    printInvoicePdf(hotel, invoice)
    toast.success('Opening print dialog…')
  }

  const showTax = invoice ? invoiceHasTaxBreakdown(invoice) : false

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Checkout invoice">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold">Guest invoice</h3>
        <p className="modal-panel-subtle text-sm">
          {guestName ?? invoice?.guestName ?? 'Guest'} checked out — print or download for the guest.
        </p>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {loading && (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading invoice…</p>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        {!loading && !error && invoice && (
          <>
            <div className="rounded-xl surface-inset p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{invoice.guestName}</p>
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
                  {invoice.nights != null && ` · ${invoice.nights} night${invoice.nights === 1 ? '' : 's'}`}
                </p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accommodation</span>
                <span className="font-medium">{money(invoice.subtotal)}</span>
              </div>
              {showTax && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NHIL + GETFund + COVID levy</span>
                    <span className="font-medium">
                      {money(invoice.nhil + invoice.getfund + invoice.covid)}
                    </span>
                  </div>
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
                </>
              )}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-lg font-bold text-foreground">{money(invoice.total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Payment method</span>
                <span className="font-medium">{formatMethod(invoice.paymentMethod)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handlePrint}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <Printer className="h-4 w-4" />
                Print invoice
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1"
        >
          Done
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

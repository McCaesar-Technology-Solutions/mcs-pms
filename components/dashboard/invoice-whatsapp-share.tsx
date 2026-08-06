'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { shareInvoiceViaWhatsApp } from '@/lib/export/invoice-pdf'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
import { hasPhoneNumber, phoneSchema } from '@/lib/phone'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'

type PhoneSource = 'record' | 'custom'

interface InvoiceWhatsAppShareProps {
  hotel: ExportHotelInfo
  invoice: InvoiceExportRow
  /** Compact embed (no card chrome) for use inside another modal. */
  embedded?: boolean
  onSent?: () => void
}

export function InvoiceWhatsAppShare({
  hotel,
  invoice,
  embedded = false,
  onSent,
}: InvoiceWhatsAppShareProps) {
  const recordPhone = invoice.guestPhone?.trim() || ''
  const hasRecord = hasPhoneNumber(recordPhone)
  const [source, setSource] = useState<PhoneSource>(hasRecord ? 'record' : 'custom')
  const [customPhone, setCustomPhone] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setSource(hasRecord ? 'record' : 'custom')
  }, [hasRecord, invoice.invoiceNumber])

  async function handleSend() {
    const raw = source === 'record' ? recordPhone : customPhone.trim()
    const parsed = phoneSchema.safeParse(raw)
    if (!parsed.success) {
      toast.error(
        source === 'record'
          ? 'Guest has no valid phone number on file.'
          : (parsed.error.issues[0]?.message ?? 'Enter a valid phone number'),
      )
      return
    }

    setPending(true)
    try {
      const result = await shareInvoiceViaWhatsApp(hotel, invoice, { phone: parsed.data })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.mode === 'share'
          ? 'Share sheet opened — pick WhatsApp to send the PDF'
          : 'PDF downloaded — WhatsApp opened with a message for the recipient',
      )
      onSent?.()
    } finally {
      setPending(false)
    }
  }

  const body = (
    <div className={embedded ? 'space-y-3' : 'space-y-4'}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Send to
        </p>
        <div className="mt-2 space-y-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              source === 'record'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-secondary/40'
            } ${!hasRecord ? 'opacity-50' : ''}`}
          >
            <input
              type="radio"
              name={`invoice-wa-phone-${invoice.invoiceNumber}`}
              className="mt-1"
              checked={source === 'record'}
              disabled={!hasRecord}
              onChange={() => setSource('record')}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                Guest number on file
              </span>
              <span className="block text-xs text-muted-foreground">
                {hasRecord ? recordPhone : 'No phone saved for this guest'}
              </span>
            </span>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              source === 'custom'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-secondary/40'
            }`}
          >
            <input
              type="radio"
              name={`invoice-wa-phone-${invoice.invoiceNumber}`}
              className="mt-1"
              checked={source === 'custom'}
              onChange={() => setSource('custom')}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Another number
              </span>
              <span className="block text-xs text-muted-foreground">
                Use a different WhatsApp number for this send
              </span>
            </span>
          </label>
        </div>
      </div>

      {source === 'custom' && (
        <div>
          <label
            htmlFor={`invoice-wa-custom-${invoice.invoiceNumber}`}
            className="text-xs font-medium text-muted-foreground"
          >
            WhatsApp number
          </label>
          <input
            id={`invoice-wa-custom-${invoice.invoiceNumber}`}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. 0241234567 or +233241234567"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-primary focus:ring-2"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={pending || (source === 'record' && !hasRecord)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
        {pending ? 'Opening WhatsApp…' : 'Send via WhatsApp'}
      </button>
    </div>
  )

  if (embedded) return body

  return <div className="rounded-xl surface-inset p-4">{body}</div>
}

interface InvoiceWhatsAppDialogProps {
  open: boolean
  onClose: () => void
  hotel: ExportHotelInfo
  invoice: InvoiceExportRow
}

export function InvoiceWhatsAppDialog({
  open,
  onClose,
  hotel,
  invoice,
}: InvoiceWhatsAppDialogProps) {
  if (!open) return null

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Send invoice via WhatsApp">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold">Send via WhatsApp</h3>
        <p className="modal-panel-subtle text-sm">
          {invoice.guestName} · {invoice.invoiceNumber}
        </p>
      </ModalHeader>
      <ModalBody>
        <InvoiceWhatsAppShare hotel={hotel} invoice={invoice} embedded onSent={onClose} />
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-muted-foreground shadow-elevation-1"
        >
          Cancel
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

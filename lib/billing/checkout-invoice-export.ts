import type { InvoiceExportRow } from '@/lib/export/types'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { stayNights } from '@/lib/stays/helpers'

export function buildCheckoutInvoicePreview(input: {
  invoiceId: string
  invoiceNumber: string
  guestName: string
  guestPhone?: string | null
  roomNumber: string | null
  checkIn: string
  checkOut: string
  issuedAt: string
  subtotal: number
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  total: number
  paymentMethod: string
  paymentStatus: string
}): InvoiceExportRow {
  return {
    invoiceNumber: formatInvoiceNumber({
      invoice_number: input.invoiceNumber,
      id: input.invoiceId,
    }),
    guestName: input.guestName,
    guestPhone: input.guestPhone ?? null,
    roomNumber: input.roomNumber,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: stayNights(input.checkIn, input.checkOut),
    issuedAt: input.issuedAt,
    subtotal: input.subtotal,
    nhil: input.nhil,
    getfund: input.getfund,
    covid: input.covid,
    vat: input.vat,
    elevy: input.elevy,
    total: input.total,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
  }
}

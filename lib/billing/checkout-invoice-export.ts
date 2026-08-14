import type { InvoiceExportRow } from '@/lib/export/types'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { stayNights } from '@/lib/stays/helpers'

export function buildCheckoutInvoicePreview(input: {
  invoiceId: string
  invoiceNumber: string
  guestName: string
  billToName?: string | null
  guestPhone?: string | null
  guestTaxId?: string | null
  roomNumber: string | null
  roomCategoryName?: string | null
  checkIn: string
  checkOut: string
  issuedAt: string
  subtotal: number
  discountAmount?: number
  discountReason?: string | null
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  tourism?: number
  taxSnapshot?: InvoiceExportRow['taxSnapshot']
  total: number
  amountPaid?: number
  paymentMethod: string
  paymentStatus: string
}): InvoiceExportRow {
  return {
    invoiceNumber: formatInvoiceNumber({
      invoice_number: input.invoiceNumber,
      id: input.invoiceId,
    }),
    guestName: input.guestName,
    billToName: input.billToName ?? null,
    guestPhone: input.guestPhone ?? null,
    guestTaxId: input.guestTaxId ?? null,
    roomNumber: input.roomNumber,
    roomCategoryName: input.roomCategoryName ?? null,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: stayNights(input.checkIn, input.checkOut),
    issuedAt: input.issuedAt,
    subtotal: input.subtotal,
    discountAmount: input.discountAmount ?? 0,
    discountReason: input.discountReason ?? null,
    nhil: input.nhil,
    getfund: input.getfund,
    covid: input.covid,
    vat: input.vat,
    elevy: input.elevy,
    tourism: input.tourism ?? 0,
    taxSnapshot: input.taxSnapshot ?? null,
    total: input.total,
    amountPaid: input.amountPaid ?? 0,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
  }
}

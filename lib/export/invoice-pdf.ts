import { jsPDF } from 'jspdf'
import { amountInWordsCedis } from '@/lib/export/amount-in-words'
import { withInvoiceHotelContact } from '@/lib/export/invoice-hotel-contact'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
import { whatsAppHref } from '@/lib/phone'
import {
  defaultHotelTaxRates,
  formatTaxPercent,
  invoiceHasTaxBreakdown,
  PAYMENT_METHOD_LABELS,
} from '@/lib/tax'

/** Brand tokens — match app/globals.css */
const BRAND = {
  purpleInk: [42, 13, 92] as const,
  purpleDeep: [72, 16, 168] as const,
  purple: [91, 24, 199] as const,
  gold: [212, 166, 46] as const,
  soft: [245, 243, 255] as const,
  muted: [92, 74, 128] as const,
  line: [221, 214, 254] as const,
  white: [255, 255, 255] as const,
  success: [16, 125, 72] as const,
}

const LOGO_PATH = '/icons/icon-192.png'
let logoDataUrlCache: string | null = null

function money(value: number): string {
  return `GHC ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function moneyPlain(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function productLabel(invoice: InvoiceExportRow): string {
  const nights = invoice.nights ?? 1
  const room = invoice.roomNumber ? `Room ${invoice.roomNumber}` : 'Accommodation'
  if (nights >= 28) {
    const months = Math.max(1, Math.round(nights / 30))
    return `${room} (${months === 1 ? 'One month' : `${months} months`})`
  }
  if (nights === 7) return `${room} (One week)`
  return `${room} (${nights} night${nights === 1 ? '' : 's'})`
}

function drawLabeledLine(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.muted)
  const labelText = `${label}: `
  doc.text(labelText, x, y)
  const labelW = doc.getTextWidth(labelText)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.purpleInk)
  const lines = doc.splitTextToSize(value, Math.max(20, maxWidth - labelW)) as string[]
  doc.text(lines, x + labelW, y)
  return y + Math.max(1, lines.length) * 4.2
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStayDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function paymentLabel(method: string | null): string {
  if (!method) return 'Unspecified'
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ')
}

async function loadBrandLogo(): Promise<string | null> {
  if (logoDataUrlCache) return logoDataUrlCache
  if (typeof fetch === 'undefined') return null
  try {
    const res = await fetch(LOGO_PATH)
    if (!res.ok) return null
    const blob = await res.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read logo'))
      reader.readAsDataURL(blob)
    })
    logoDataUrlCache = dataUrl
    return dataUrl
  } catch {
    return null
  }
}

function invoiceFileName(invoice: InvoiceExportRow): string {
  return `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`
}

function invoiceWhatsAppMessage(hotel: ExportHotelInfo, invoice: InvoiceExportRow): string {
  const status = invoice.paymentStatus === 'paid' ? 'paid' : 'issued'
  return [
    `Hi ${invoice.guestName},`,
    '',
    `Here is your ${status} invoice from ${hotel.name}.`,
    `Invoice: ${invoice.invoiceNumber}`,
    `Amount: ${money(invoice.total)}`,
    invoice.issuedAt ? `Date: ${formatDateTime(invoice.issuedAt)}` : null,
    '',
    'Please find the PDF attached (or attach the downloaded invoice to this chat).',
    'Thank you for staying with us.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function buildInvoicePdf(hotelInput: ExportHotelInfo, invoice: InvoiceExportRow): Promise<jsPDF> {
  const hotel = withInvoiceHotelContact(hotelInput)
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  const showTax = invoiceHasTaxBreakdown(invoice)
  const generatedAt = new Date().toISOString()
  const logo = await loadBrandLogo()

  // ── Header band ──────────────────────────────────────────────
  doc.setFillColor(...BRAND.purpleDeep)
  doc.rect(0, 0, pageW, 36, 'F')
  doc.setFillColor(...BRAND.gold)
  doc.rect(0, 36, pageW, 1.6, 'F')

  if (logo) {
    doc.addImage(logo, 'PNG', margin, 8, 16, 16)
  } else {
    doc.setFillColor(...BRAND.gold)
    doc.roundedRect(margin, 10, 12, 12, 2, 2, 'F')
    doc.setTextColor(...BRAND.purpleInk)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('M', margin + 6, 18, { align: 'center' })
  }

  const textLeft = margin + (logo ? 20 : 16)
  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(hotel.name, textLeft, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(230, 220, 255)
  if (hotel.vatRegistrationNumber) {
    doc.text(`VAT Reg: ${hotel.vatRegistrationNumber}`, textLeft, 23)
  }

  // Invoice badge (right)
  doc.setFillColor(...BRAND.gold)
  const badgeLabel = showTax ? 'TAX INVOICE' : 'INVOICE'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  const badgeW = doc.getTextWidth(badgeLabel) + 10
  doc.roundedRect(pageW - margin - badgeW, 10, badgeW, 7, 1.5, 1.5, 'F')
  doc.setTextColor(...BRAND.purpleInk)
  doc.text(badgeLabel, pageW - margin - badgeW / 2, 14.8, { align: 'center' })

  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(invoice.invoiceNumber, pageW - margin, 24, { align: 'right' })

  let y = 44

  // ── Property contact letterhead ───────────────────────────────
  const contactTop = y
  const contactMaxW = contentW - 8
  const contactLines =
    (hotel.address ? 1 : 0) + (hotel.location ? 1 : 0) + (hotel.phone || hotel.email ? 1 : 0)
  const contactH = 6 + contactLines * 4.6 + 3
  doc.setFillColor(...BRAND.soft)
  doc.roundedRect(margin, contactTop, contentW, contactH, 2, 2, 'F')

  let contactY = contactTop + 5
  if (hotel.address) {
    contactY = drawLabeledLine(doc, 'Address', hotel.address, margin + 4, contactY, contactMaxW)
  }
  if (hotel.location) {
    contactY = drawLabeledLine(doc, 'Location', hotel.location, margin + 4, contactY, contactMaxW)
  }
  if (hotel.phone) {
    drawLabeledLine(doc, 'Tel', hotel.phone, margin + 4, contactY, contentW / 2 - 10)
  }
  if (hotel.email) {
    drawLabeledLine(doc, 'E-mail', hotel.email, margin + contentW / 2, contactY, contentW / 2 - 8)
  }
  y = contactTop + contactH + 6

  // ── Meta strip: dates ────────────────────────────────────────
  doc.setFillColor(...BRAND.soft)
  doc.roundedRect(margin, y, contentW, 16, 2, 2, 'F')

  const issuedLabel = invoice.issuedAt ? formatDateTime(invoice.issuedAt) : formatDateTime(generatedAt)
  const generatedLabel = formatDateTime(generatedAt)

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND.muted)
  doc.text('ISSUED', margin + 4, y + 5.5)
  doc.text('GENERATED', margin + contentW / 2, y + 5.5)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND.purpleInk)
  doc.text(issuedLabel, margin + 4, y + 11.5)
  doc.text(generatedLabel, margin + contentW / 2, y + 11.5)

  y += 24

  // ── Bill to ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.gold)
  doc.text('BILL TO', margin, y)
  y += 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text(invoice.guestName, margin, y)
  y += 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.muted)

  if (invoice.roomNumber) {
    doc.text(`Room ${invoice.roomNumber}`, margin, y)
    y += 4.5
  }
  if (invoice.guestPhone) {
    doc.text(invoice.guestPhone, margin, y)
    y += 4.5
  }
  if (invoice.guestTaxId) {
    doc.text(`Tax ID: ${invoice.guestTaxId}`, margin, y)
    y += 4.5
  }
  if (invoice.checkIn && invoice.checkOut) {
    const nights = invoice.nights ?? 1
    doc.text(
      `Stay: ${formatStayDate(invoice.checkIn)} – ${formatStayDate(invoice.checkOut)} (${nights} night${nights === 1 ? '' : 's'})`,
      margin,
      y,
    )
    y += 4.5
  }

  y += 8

  // ── Product table (Sr no. | Product | Qty | Rate | Amount) ───
  const discountAmount = Math.max(0, Number(invoice.discountAmount ?? 0))
  const accommodation = discountAmount > 0 ? invoice.subtotal + discountAmount : invoice.subtotal
  const lineItems: Array<{ product: string; qty: number; rate: number; amount: number }> = [
    {
      product: productLabel(invoice),
      qty: 1,
      rate: accommodation,
      amount: accommodation,
    },
  ]
  if (discountAmount > 0) {
    const reason = invoice.discountReason?.trim()
    lineItems.push({
      product: reason ? `Discount — ${reason}` : 'Discount',
      qty: 1,
      rate: -discountAmount,
      amount: -discountAmount,
    })
  }

  // Fixed column widths so numeric cells keep padding from their left borders.
  const tableLeft = margin
  const tableRight = pageW - margin
  const wSr = 14
  const wQty = 18
  const wRate = 30
  const wAmount = 32
  const wProduct = contentW - wSr - wQty - wRate - wAmount
  const col = {
    sr: tableLeft,
    product: tableLeft + wSr,
    qty: tableLeft + wSr + wProduct,
    rate: tableLeft + wSr + wProduct + wQty,
    amount: tableLeft + wSr + wProduct + wQty + wRate,
    end: tableRight,
  }
  const pad = 2
  const rowH = 8
  const headerH = 8

  // Header
  doc.setFillColor(...BRAND.purple)
  doc.rect(margin, y, contentW, headerH, 'F')
  doc.setDrawColor(60, 40, 100)
  doc.setLineWidth(0.25)
  doc.rect(margin, y, contentW, headerH, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.white)
  doc.text('Sr no.', col.sr + pad, y + 5.3)
  doc.text('Product', col.product + pad, y + 5.3)
  doc.text('Qty', col.rate - pad, y + 5.3, { align: 'right' })
  doc.text('Rate', col.amount - pad, y + 5.3, { align: 'right' })
  doc.text('Amount', col.end - pad, y + 5.3, { align: 'right' })
  y += headerH

  const drawVLines = (top: number, bottom: number) => {
    doc.setDrawColor(160, 160, 170)
    doc.setLineWidth(0.2)
    for (const x of [col.product, col.qty, col.rate, col.amount]) {
      doc.line(x, top, x, bottom)
    }
  }

  let qtySum = 0
  let lineTotal = 0
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  lineItems.forEach((item, index) => {
    const top = y
    doc.setFillColor(...BRAND.white)
    doc.rect(margin, top, contentW, rowH, 'F')
    doc.setDrawColor(160, 160, 170)
    doc.rect(margin, top, contentW, rowH, 'S')
    drawVLines(top, top + rowH)

    doc.setTextColor(...BRAND.purpleInk)
    doc.text(String(index + 1), col.sr + pad, top + 5.3)
    const productLines = doc.splitTextToSize(item.product, wProduct - pad * 2) as string[]
    doc.text(productLines[0] ?? item.product, col.product + pad, top + 5.3)
    doc.text(moneyPlain(item.qty), col.rate - pad, top + 5.3, { align: 'right' })
    doc.text(moneyPlain(item.rate), col.amount - pad, top + 5.3, { align: 'right' })
    doc.text(moneyPlain(item.amount), col.end - pad, top + 5.3, { align: 'right' })
    qtySum += item.qty
    lineTotal += item.amount
    y += rowH
  })

  // Table footer Total row
  doc.setFillColor(235, 235, 238)
  doc.rect(margin, y, contentW, rowH, 'F')
  doc.setDrawColor(160, 160, 170)
  doc.rect(margin, y, contentW, rowH, 'S')
  drawVLines(y, y + rowH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text('Total', col.product + pad, y + 5.3)
  doc.text(moneyPlain(qtySum), col.rate - pad, y + 5.3, { align: 'right' })
  doc.text('-', col.amount - pad, y + 5.3, { align: 'right' })
  doc.text(moneyPlain(lineTotal), col.end - pad, y + 5.3, { align: 'right' })
  y += rowH + 8

  // ── Please Note (left) + Totals (right) ──────────────────────
  const noteLeft = margin
  const noteW = contentW * 0.52
  const totalsW = contentW * 0.42
  const totalsLeft = pageW - margin - totalsW
  const blockTop = y

  // Please Note
  doc.setDrawColor(...BRAND.purple)
  doc.setLineWidth(0.5)
  doc.line(noteLeft, blockTop, noteLeft + noteW, blockTop)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text('Please Note', noteLeft, blockTop + 5)
  doc.line(noteLeft, blockTop + 7, noteLeft + noteW, blockTop + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.muted)
  const noteLines = doc.splitTextToSize(
    '1. Full payment is required before guests are allowed to check in.',
    noteW,
  ) as string[]
  doc.text(noteLines, noteLeft, blockTop + 12)

  // Totals column
  let ty = blockTop
  doc.setDrawColor(...BRAND.purple)
  doc.setLineWidth(0.5)
  doc.line(totalsLeft, ty, tableRight, ty)
  ty += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text(money(invoice.subtotal), tableRight, ty, { align: 'right' })
  ty += 5

  if (showTax) {
    const rates = invoice.taxSnapshot ?? defaultHotelTaxRates()
    const taxRows: [string, number][] = [
      [`NHIL (${formatTaxPercent(rates.nhil)})`, invoice.nhil],
      [`GETFund (${formatTaxPercent(rates.getfund)})`, invoice.getfund],
    ]
    if (invoice.covid > 0 || rates.covid > 0) {
      taxRows.push([`COVID-19 levy (${formatTaxPercent(rates.covid)})`, invoice.covid])
    }
    taxRows.push([`VAT (${formatTaxPercent(rates.vat)})`, invoice.vat])
    if ((invoice.elevy ?? 0) > 0 || rates.elevy > 0) {
      taxRows.push([`E-Levy (${formatTaxPercent(rates.elevy)})`, invoice.elevy])
    }
    if ((invoice.tourism ?? 0) > 0 || rates.tourism > 0) {
      taxRows.push([`Tourism levy (${formatTaxPercent(rates.tourism)})`, invoice.tourism ?? 0])
    }

    doc.setFontSize(7.5)
    for (const [label, amount] of taxRows) {
      if (amount <= 0 && !label.startsWith('VAT')) continue
      doc.setTextColor(...BRAND.muted)
      doc.text(label, totalsLeft, ty)
      doc.setTextColor(...BRAND.purpleInk)
      doc.text(money(amount), tableRight, ty, { align: 'right' })
      ty += 4
    }
    ty += 2
  }

  // Grand Total bar
  const grandH = 8
  doc.setFillColor(...BRAND.purple)
  doc.rect(totalsLeft, ty, totalsW, grandH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.white)
  doc.text('Grand Total', totalsLeft + 3, ty + 5.5)
  doc.text(money(invoice.total), tableRight - 2, ty + 5.5, { align: 'right' })
  ty += grandH + 5

  const amountPaid = Math.max(0, Number(invoice.amountPaid ?? 0))
  const balance = Math.max(0, Math.round((invoice.total - amountPaid) * 100) / 100)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text('Balance', totalsLeft, ty)
  doc.text(money(balance), tableRight, ty, { align: 'right' })
  ty += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.muted)
  doc.text(`Method: ${paymentLabel(invoice.paymentMethod)}`, totalsLeft, ty)
  const status = (invoice.paymentStatus ?? 'pending').toUpperCase()
  if (invoice.paymentStatus === 'paid') {
    doc.setTextColor(...BRAND.success)
  } else {
    doc.setTextColor(...BRAND.purple)
  }
  doc.setFont('helvetica', 'bold')
  doc.text(status, tableRight, ty, { align: 'right' })

  y = Math.max(blockTop + 12 + noteLines.length * 4, ty) + 10

  // ── Amount in words ──────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.purpleInk)
  const words = amountInWordsCedis(invoice.total)
  const wordsLine = doc.splitTextToSize(`Amount In Words : ${words}`, contentW) as string[]
  doc.text(wordsLine, margin, y)
  y += wordsLine.length * 4.5 + 4

  // ── Footer ───────────────────────────────────────────────────
  const footerY = Math.max(y + 4, pageH - 22)
  doc.setDrawColor(...BRAND.line)
  doc.setLineWidth(0.4)
  doc.line(margin, footerY, pageW - margin, footerY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.muted)
  const footerContact = [hotel.phone ? `Tel ${hotel.phone}` : null, hotel.email || null]
    .filter(Boolean)
    .join('  ·  ')
  if (footerContact) {
    doc.text(footerContact, margin, footerY + 5)
  }
  doc.text(`Page 1 · ${formatDateTime(generatedAt)}`, pageW - margin, footerY + 5, {
    align: 'right',
  })
  doc.text('Thank you for staying with us.', margin, footerY + 10)

  return doc
}

export async function downloadInvoicePdf(
  hotel: ExportHotelInfo,
  invoice: InvoiceExportRow,
): Promise<void> {
  const doc = await buildInvoicePdf(hotel, invoice)
  doc.save(invoiceFileName(invoice))
}

export async function printInvoicePdf(
  hotel: ExportHotelInfo,
  invoice: InvoiceExportRow,
): Promise<void> {
  const doc = await buildInvoicePdf(hotel, invoice)
  doc.autoPrint()
  const blobUrl = doc.output('bloburl')
  const printWindow = window.open(blobUrl, '_blank')
  if (!printWindow) {
    doc.save(invoiceFileName(invoice))
  }
}

export type ShareInvoiceWhatsAppResult =
  | { ok: true; mode: 'share' | 'whatsapp' }
  | { ok: false; error: string }

/**
 * Share the invoice PDF via WhatsApp.
 * Prefers the Web Share API (mobile can attach the PDF to WhatsApp).
 * Falls back to downloading the PDF and opening wa.me with a prefilled message.
 *
 * Pass `options.phone` to send to a number other than the guest record.
 */
export async function shareInvoiceViaWhatsApp(
  hotel: ExportHotelInfo,
  invoice: InvoiceExportRow,
  options?: { phone?: string | null },
): Promise<ShareInvoiceWhatsAppResult> {
  const phone = options?.phone?.trim() || invoice.guestPhone?.trim()
  if (!phone) {
    return { ok: false, error: 'Enter a phone number to send the invoice.' }
  }

  const href = whatsAppHref(phone)
  if (!href) {
    return { ok: false, error: 'Phone number is not valid for WhatsApp.' }
  }

  const doc = await buildInvoicePdf(hotel, invoice)
  const filename = invoiceFileName(invoice)
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  const message = invoiceWhatsAppMessage(hotel, invoice)

  const shareData: ShareData = {
    files: [file],
    title: `Invoice ${invoice.invoiceNumber}`,
    text: message,
  }

  if (typeof navigator !== 'undefined' && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData)
      return { ok: true, mode: 'share' }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'Share cancelled.' }
      }
      // Fall through to wa.me
    }
  }

  doc.save(filename)
  window.open(whatsAppHref(phone, message), '_blank', 'noopener,noreferrer')
  return { ok: true, mode: 'whatsapp' }
}

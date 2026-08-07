import { jsPDF } from 'jspdf'
import { withInvoiceHotelContact } from '@/lib/export/invoice-hotel-contact'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
import { whatsAppHref } from '@/lib/phone'
import { invoiceHasTaxBreakdown, PAYMENT_METHOD_LABELS } from '@/lib/tax'

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
  return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  // ── Line items table ─────────────────────────────────────────
  const colDesc = margin
  const colAmt = pageW - margin

  doc.setFillColor(...BRAND.purple)
  doc.roundedRect(margin, y, contentW, 8, 1.5, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.white)
  doc.text('DESCRIPTION', colDesc + 3, y + 5.3)
  doc.text('AMOUNT', colAmt - 3, y + 5.3, { align: 'right' })
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text('Room accommodation', colDesc + 3, y)
  doc.text(money(invoice.subtotal), colAmt - 3, y, { align: 'right' })
  y += 8

  if (showTax) {
    doc.setDrawColor(...BRAND.line)
    doc.setLineWidth(0.3)
    doc.line(margin, y - 3, pageW - margin, y - 3)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.muted)
    doc.text('GRA TAX BREAKDOWN', colDesc + 3, y + 1)
    y += 7

    const taxRows: [string, number][] = [
      ['NHIL (2.5%)', invoice.nhil],
      ['GETFund (2.5%)', invoice.getfund],
      ['COVID-19 levy (1%)', invoice.covid],
      ['VAT (15%)', invoice.vat],
    ]
    if (invoice.elevy > 0) taxRows.push(['E-Levy', invoice.elevy])

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const [label, amount] of taxRows) {
      doc.setTextColor(...BRAND.muted)
      doc.text(label, colDesc + 3, y)
      doc.setTextColor(...BRAND.purpleInk)
      doc.text(money(amount), colAmt - 3, y, { align: 'right' })
      y += 5
    }
    y += 3
  }

  // ── Total bar ────────────────────────────────────────────────
  doc.setFillColor(...BRAND.purpleInk)
  doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F')
  doc.setFillColor(...BRAND.gold)
  doc.rect(margin, y, 1.8, 12, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND.white)
  doc.text('TOTAL', colDesc + 6, y + 7.8)
  doc.setTextColor(...BRAND.gold)
  doc.text(money(invoice.total), colAmt - 3, y + 7.8, { align: 'right' })
  y += 18

  // ── Payment details ──────────────────────────────────────────
  doc.setFillColor(...BRAND.soft)
  doc.roundedRect(margin, y, contentW, 18, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.muted)
  doc.text('PAYMENT METHOD', margin + 4, y + 5.5)
  doc.text('STATUS', margin + contentW / 2, y + 5.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.purpleInk)
  doc.text(paymentLabel(invoice.paymentMethod), margin + 4, y + 12)

  const status = (invoice.paymentStatus ?? 'pending').toUpperCase()
  if (invoice.paymentStatus === 'paid') {
    doc.setTextColor(...BRAND.success)
  } else {
    doc.setTextColor(...BRAND.purple)
  }
  doc.setFont('helvetica', 'bold')
  doc.text(status, margin + contentW / 2, y + 12)

  // ── Footer ───────────────────────────────────────────────────
  const footerY = pageH - 22
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

import { jsPDF } from 'jspdf'
import type { ExportHotelInfo, InvoiceExportRow } from '@/lib/export/types'
import { invoiceHasTaxBreakdown } from '@/lib/tax'

function money(value: number): string {
  return `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function hotelAddress(hotel: ExportHotelInfo): string {
  return [hotel.address, hotel.city, hotel.region].filter(Boolean).join(', ')
}

function buildInvoicePdf(hotel: ExportHotelInfo, invoice: InvoiceExportRow): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(hotel.name, 14, y)

  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const addr = hotelAddress(hotel)
  if (addr) {
    doc.text(addr, 14, y)
    y += 5
  }
  if (hotel.vatRegistrationNumber) {
    doc.text(`VAT Reg: ${hotel.vatRegistrationNumber}`, 14, y)
    y += 5
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  const showTax = invoiceHasTaxBreakdown(invoice)
  doc.text(showTax ? 'TAX INVOICE' : 'INVOICE', pageW - 14, 18, { align: 'right' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.invoiceNumber, pageW - 14, 26, { align: 'right' })

  if (invoice.issuedAt) {
    doc.setFontSize(9)
    doc.text(
      `Issued: ${new Date(invoice.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      pageW - 14,
      32,
      { align: 'right' },
    )
  }

  y += 10
  doc.setDrawColor(220)
  doc.line(14, y, pageW - 14, y)
  y += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bill to', 14, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.guestName, 14, y)
  if (invoice.roomNumber) {
    y += 5
    doc.text(`Room ${invoice.roomNumber}`, 14, y)
  }

  if (invoice.checkIn && invoice.checkOut) {
    y += 5
    const fmt = (d: string) =>
      new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    const nights = invoice.nights ?? 1
    doc.text(`Stay: ${fmt(invoice.checkIn)} – ${fmt(invoice.checkOut)} (${nights} night${nights === 1 ? '' : 's'})`, 14, y)
  }

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 14, y)
  doc.text('Amount', pageW - 14, y, { align: 'right' })
  y += 2
  doc.line(14, y, pageW - 14, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.text('Room accommodation', 14, y)
  doc.text(money(invoice.subtotal), pageW - 14, y, { align: 'right' })
  y += 10

  if (showTax) {
    doc.setFont('helvetica', 'bold')
    doc.text('GRA tax breakdown', 14, y)
    y += 7
    doc.setFont('helvetica', 'normal')

    const taxRows: [string, number][] = [
      ['NHIL (2.5%)', invoice.nhil],
      ['GETFund (2.5%)', invoice.getfund],
      ['COVID-19 levy (1%)', invoice.covid],
      ['VAT (15%)', invoice.vat],
    ]
    if (invoice.elevy > 0) taxRows.push(['E-Levy', invoice.elevy])

    for (const [label, amount] of taxRows) {
      doc.text(label, 14, y)
      doc.text(money(amount), pageW - 14, y, { align: 'right' })
      y += 5
    }

    y += 4
  }

  doc.setDrawColor(220)
  doc.line(14, y, pageW - 14, y)
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Total', 14, y)
  doc.text(money(invoice.total), pageW - 14, y, { align: 'right' })
  y += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  if (invoice.paymentMethod) {
    doc.text(`Payment method: ${invoice.paymentMethod.replace(/_/g, ' ')}`, 14, y)
    y += 5
  }
  if (invoice.paymentStatus) {
    doc.text(`Status: ${invoice.paymentStatus}`, 14, y)
  }

  return doc
}

export function downloadInvoicePdf(hotel: ExportHotelInfo, invoice: InvoiceExportRow): void {
  const doc = buildInvoicePdf(hotel, invoice)
  doc.save(`${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`)
}

export function printInvoicePdf(hotel: ExportHotelInfo, invoice: InvoiceExportRow): void {
  const doc = buildInvoicePdf(hotel, invoice)
  doc.autoPrint()
  const blobUrl = doc.output('bloburl')
  const printWindow = window.open(blobUrl, '_blank')
  if (!printWindow) {
    doc.save(`${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`)
  }
}

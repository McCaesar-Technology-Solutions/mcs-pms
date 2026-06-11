import { jsPDF } from 'jspdf'
import type { DbInvoice } from '@/types'
import type { ExportHotelInfo } from '@/lib/export/types'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { GraReportRow } from '@/lib/data/gra-reports'

function money(value: number): string {
  return value.toFixed(2)
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function invoicesForPeriod(invoices: DbInvoice[], yearMonth: string): DbInvoice[] {
  return invoices.filter((inv) => inv.issued_at?.startsWith(yearMonth))
}

function invoiceToCsvRow(inv: DbInvoice): string {
  const num = formatInvoiceNumber(inv)
  const issued = inv.issued_at ? inv.issued_at.slice(0, 10) : ''
  const method = inv.payment_method
    ? (PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method)
    : ''
  return [
    num,
    inv.guest_name,
    issued,
    money(inv.subtotal ?? 0),
    money(inv.nhil_amount ?? 0),
    money(inv.getfund_amount ?? 0),
    money(inv.covid_levy_amount ?? 0),
    money(inv.vat_amount ?? 0),
    money(inv.elevy_amount ?? 0),
    money(inv.total_amount ?? 0),
    inv.payment_status ?? '',
    method,
  ]
    .map((v) => csvEscape(String(v)))
    .join(',')
}

export function downloadGraCsv(
  report: GraReportRow,
  invoices: DbInvoice[],
): void {
  const periodInvoices = invoicesForPeriod(invoices, report.yearMonth)
  const header = [
    'Invoice Number',
    'Guest Name',
    'Issued Date',
    'Subtotal',
    'NHIL',
    'GETFund',
    'COVID Levy',
    'VAT',
    'E-Levy',
    'Total',
    'Payment Status',
    'Payment Method',
  ].join(',')

  const rows = periodInvoices.map(invoiceToCsvRow)
  const summary = [
    '',
    'SUMMARY',
    report.month,
    '',
    '',
    '',
    '',
    '',
    '',
    money(report.totalRevenue),
    '',
    '',
  ].join(',')

  const content = [header, ...rows, '', summary].join('\n')
  downloadBlob(`GRA-${report.yearMonth}.csv`, content, 'text/csv;charset=utf-8')
}

function buildGraCsvContent(report: GraReportRow, invoices: DbInvoice[]): string {
  const periodInvoices = invoicesForPeriod(invoices, report.yearMonth)
  const header = [
    'Invoice Number',
    'Guest Name',
    'Issued Date',
    'Subtotal',
    'NHIL',
    'GETFund',
    'COVID Levy',
    'VAT',
    'E-Levy',
    'Total',
    'Payment Status',
    'Payment Method',
  ].join(',')

  const rows = periodInvoices.map(invoiceToCsvRow)
  const summary = [
    '',
    'SUMMARY',
    report.month,
    '',
    '',
    '',
    '',
    '',
    '',
    money(report.totalRevenue),
    '',
    '',
  ].join(',')

  return [header, ...rows, '', summary].join('\n')
}

export async function downloadGraAllZip(
  reports: GraReportRow[],
  invoices: DbInvoice[],
): Promise<void> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  for (const report of reports) {
    zip.file(`GRA-${report.yearMonth}.csv`, buildGraCsvContent(report, invoices))
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `GRA-all-periods-${new Date().getFullYear()}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadGraPdf(
  hotel: ExportHotelInfo,
  report: GraReportRow,
  invoices: DbInvoice[],
): void {
  const periodInvoices = invoicesForPeriod(invoices, report.yearMonth)
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  let y = 16

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(hotel.name, 14, y)
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('GRA Monthly Tax Report', 14, y)
  y += 5
  doc.text(`Period: ${report.month}`, 14, y)
  if (hotel.vatRegistrationNumber) {
    y += 5
    doc.text(`VAT Reg: ${hotel.vatRegistrationNumber}`, 14, y)
  }

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(`Total revenue: GHS ${report.totalRevenue.toLocaleString()}`, 14, y)
  y += 6
  doc.text(`Total tax: GHS ${report.taxAmount.toLocaleString()}`, 14, y)
  y += 6
  doc.text(`Invoices: ${report.invoicesPaid}/${report.invoicesIssued} paid`, 14, y)
  y += 10

  const cols = [14, 48, 78, 98, 112, 126, 142, 156, 170, 188, 210, 248]
  const headers = ['Invoice', 'Guest', 'Date', 'Sub', 'NHIL', 'GETF', 'COV', 'VAT', 'E-L', 'Total', 'Status', 'Method']

  doc.setFontSize(7)
  headers.forEach((h, i) => doc.text(h, cols[i], y))
  y += 2
  doc.setDrawColor(200)
  doc.line(14, y, pageW - 14, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  for (const inv of periodInvoices) {
    if (y > 190) {
      doc.addPage()
      y = 16
    }
    const issued = inv.issued_at ? inv.issued_at.slice(0, 10) : '—'
    const method = inv.payment_method
      ? (PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method).slice(0, 12)
      : '—'
    const cells = [
      formatInvoiceNumber(inv).slice(0, 16),
      inv.guest_name.slice(0, 18),
      issued,
      money(inv.subtotal ?? 0),
      money(inv.nhil_amount ?? 0),
      money(inv.getfund_amount ?? 0),
      money(inv.covid_levy_amount ?? 0),
      money(inv.vat_amount ?? 0),
      money(inv.elevy_amount ?? 0),
      money(inv.total_amount ?? 0),
      (inv.payment_status ?? '—').slice(0, 8),
      method,
    ]
    cells.forEach((cell, i) => doc.text(cell, cols[i], y))
    y += 5
  }

  doc.save(`GRA-${report.yearMonth}.pdf`)
}

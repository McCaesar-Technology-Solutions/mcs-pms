import type { DbInvoice } from '@/types'

export interface GraReportRow {
  id: string
  yearMonth: string
  month: string
  totalRevenue: number
  taxAmount: number
  invoicesIssued: number
  invoicesPaid: number
  status: 'pending' | 'submitted' | 'approved'
}

export interface GraReportsSummary {
  nextDeadline: string | null
  nextDeadlineLabel: string | null
  compliancePct: number
  taxPaidYtd: number
}

function invoiceTax(inv: DbInvoice): number {
  return (
    (inv.vat_amount ?? 0) +
    (inv.nhil_amount ?? 0) +
    (inv.getfund_amount ?? 0) +
    (inv.covid_levy_amount ?? 0) +
    (inv.elevy_amount ?? 0)
  )
}

function monthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function filingDeadline(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const deadline = new Date(y, m, 5)
  return deadline.toISOString().split('T')[0]
}

export function computeGraReports(invoices: DbInvoice[]): GraReportRow[] {
  const byMonth = new Map<string, DbInvoice[]>()

  for (const inv of invoices) {
    const raw = inv.issued_at
    if (!raw) continue
    const key = raw.slice(0, 7)
    const list = byMonth.get(key) ?? []
    list.push(inv)
    byMonth.set(key, list)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([yearMonth, monthInvoices]) => {
      const totalRevenue = monthInvoices.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0)
      const taxAmount = monthInvoices.reduce((sum, inv) => sum + invoiceTax(inv), 0)
      const invoicesPaid = monthInvoices.filter((inv) => inv.payment_status === 'paid').length

      return {
        id: `GRA-${yearMonth}`,
        yearMonth,
        month: monthLabel(yearMonth),
        totalRevenue: Math.round(totalRevenue),
        taxAmount: Math.round(taxAmount),
        invoicesIssued: monthInvoices.length,
        invoicesPaid,
        status: invoicesPaid === monthInvoices.length && monthInvoices.length > 0 ? 'approved' : 'pending',
      }
    })
}

export function computeGraReportsSummary(reports: GraReportRow[]): GraReportsSummary {
  const year = new Date().getFullYear()
  const taxPaidYtd = reports
    .filter((r) => r.id.includes(String(year)))
    .reduce((sum, r) => sum + r.taxAmount, 0)

  const pending = reports.find((r) => r.status === 'pending')
  const latest = reports[0]

  return {
    nextDeadline: pending ? filingDeadline(pending.id.replace('GRA-', '')) : null,
    nextDeadlineLabel: pending?.month ?? latest?.month ?? null,
    compliancePct: reports.length === 0 ? 0 : Math.round((reports.filter((r) => r.status === 'approved').length / reports.length) * 100),
    taxPaidYtd,
  }
}

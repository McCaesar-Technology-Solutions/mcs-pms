'use client'

import { useState } from 'react'
import { Download, Plus, TrendingUp } from 'lucide-react'
import { CenteredModal, ModalBody, ModalHeader } from '@/components/ui/centered-modal'
import { PAYMENT_METHOD_LABELS } from '@/lib/tax'
import type { InvoiceWithRoom } from '@/lib/data/billing'

interface BillingRow {
  id: string
  guestName: string
  roomNumber: string | number
  amount: number
  status: string
  date: string
  dueDate: string
  paymentMethod: string
  invoice?: InvoiceWithRoom
}

function formatMethod(method: string | null): string {
  if (!method) return 'Unspecified'
  return PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ')
}

function mapInvoices(invoices: InvoiceWithRoom[]): BillingRow[] {
  const todayStr = new Date().toISOString().slice(0, 10)
  return invoices.map((inv) => {
    let status = inv.payment_status ?? 'pending'
    if (status === 'pending' && inv.due_at && inv.due_at.slice(0, 10) < todayStr) {
      status = 'overdue'
    }
    return {
      id: `INV-${inv.id.slice(0, 6).toUpperCase()}`,
      guestName: inv.guest_name,
      roomNumber: inv.roomNumber ?? '—',
      amount: inv.total_amount ?? 0,
      status,
      date: (inv.issued_at ?? new Date().toISOString()).slice(0, 10),
      dueDate: (inv.due_at ?? inv.issued_at ?? new Date().toISOString()).slice(0, 10),
      paymentMethod: formatMethod(inv.payment_method),
      invoice: inv,
    }
  })
}

const MOCK_INVOICES: BillingRow[] = [
  { id: 'INV-001', guestName: 'Ama Mensah', roomNumber: 302, amount: 1200, status: 'paid', date: '2026-06-01', dueDate: '2026-06-05', paymentMethod: 'Credit Card' },
  { id: 'INV-002', guestName: 'Kwame Asante', roomNumber: 215, amount: 850, status: 'pending', date: '2026-06-03', dueDate: '2026-06-08', paymentMethod: 'Bank Transfer' },
  { id: 'INV-003', guestName: 'Abena Osei', roomNumber: 401, amount: 2100, status: 'paid', date: '2026-05-28', dueDate: '2026-06-02', paymentMethod: 'Cash' },
  { id: 'INV-004', guestName: 'Kofi Boateng', roomNumber: 308, amount: 950, status: 'overdue', date: '2026-05-20', dueDate: '2026-05-25', paymentMethod: 'Pending' },
  { id: 'INV-005', guestName: 'Nana Acheampong', roomNumber: 105, amount: 650, status: 'pending', date: '2026-06-04', dueDate: '2026-06-09', paymentMethod: 'Mobile Money' },
]

function money(value: number | null | undefined) {
  return `₵${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function BillingOverview({ invoices }: { invoices?: InvoiceWithRoom[] }) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [detail, setDetail] = useState<InvoiceWithRoom | null>(null)

  const rows: BillingRow[] = invoices ? mapInvoices(invoices) : MOCK_INVOICES

  const totalRevenue = rows.reduce((sum, inv) => sum + inv.amount, 0)
  const paidAmount = rows.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
  const pendingAmount = rows
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const collectionRate = totalRevenue > 0 ? (paidAmount / totalRevenue) * 100 : 0

  const filteredInvoices = statusFilter ? rows.filter((inv) => inv.status === statusFilter) : rows

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-amber-600 text-amber-50'
      case 'pending':
        return 'bg-amber-600 text-amber-50'
      case 'overdue':
        return 'bg-red-600 text-red-50'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="surface-card stat-tile stat-tile-emerald p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Total Revenue</p>
          <p className="text-3xl font-bold text-foreground mt-3">₵{totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-4 text-amber-600 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            June 2026
          </div>
        </div>

        <div className="surface-card stat-tile stat-tile-blue p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Paid Invoices</p>
          <p className="text-3xl font-bold text-foreground mt-3">₵{paidAmount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{rows.filter((inv) => inv.status === 'paid').length} invoices</p>
        </div>

        <div className="surface-card stat-tile stat-tile-amber p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Pending Invoices</p>
          <p className="text-3xl font-bold text-foreground mt-3">₵{pendingAmount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{rows.filter((inv) => inv.status === 'pending' || inv.status === 'overdue').length} invoices</p>
        </div>

        <div className="surface-card stat-tile stat-tile-purple p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Collection Rate</p>
          <p className="text-3xl font-bold text-foreground mt-3">{Math.round(collectionRate)}%</p>
          <div className="w-full bg-secondary rounded-full h-2 mt-4">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${collectionRate}%` }}></div>
          </div>
        </div>
      </div>

      <div className="surface-card">
        <div className="surface-card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Invoices</h2>
            <p className="text-sm text-muted-foreground mt-1">{filteredInvoices.length} invoices</p>
          </div>
          <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>

        <div className="surface-card-header flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              statusFilter === null ? 'bg-primary text-primary-foreground shadow-elevation-1' : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            All
          </button>
          {['paid', 'pending', 'overdue'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                statusFilter === status ? 'bg-primary text-primary-foreground shadow-elevation-1' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {filteredInvoices.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            No invoices yet. They are generated automatically when a guest checks out.
          </p>
        )}

        <div className="space-y-3 p-4 md:hidden">
          {filteredInvoices.map((invoice) => (
            <button
              key={invoice.id}
              type="button"
              onClick={() => invoice.invoice && setDetail(invoice.invoice)}
              className="elevated-list-item w-full p-4 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{invoice.id}</p>
                  <p className="mt-0.5 text-sm text-foreground">{invoice.guestName}</p>
                  <p className="text-xs text-muted-foreground">Room {invoice.roomNumber}</p>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold ${getStatusColor(invoice.status)}`}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="text-foreground">{new Date(invoice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-xs text-muted-foreground">{invoice.paymentMethod}</p>
                </div>
                <p className="text-lg font-bold text-foreground">{money(invoice.amount)}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Invoice</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Guest & Room</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Date</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Payment Method</th>
                <th className="text-right py-4 px-6 font-semibold text-foreground">Amount</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Status</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className={invoice.invoice ? 'cursor-pointer' : ''}
                  onClick={() => invoice.invoice && setDetail(invoice.invoice)}
                >
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground">{invoice.id}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-foreground">{invoice.guestName}</p>
                    <p className="text-xs text-muted-foreground">Room {invoice.roomNumber}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-foreground">{new Date(invoice.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    <p className="text-xs text-muted-foreground">Due: {new Date(invoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-muted-foreground">{invoice.paymentMethod}</p>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <p className="font-bold text-foreground">{money(invoice.amount)}</p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(invoice.status)} shadow-elevation-1`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CenteredModal open={!!detail} onClose={() => setDetail(null)} className="max-w-md" aria-label="Invoice details">
        {detail && (
          <>
            <ModalHeader onClose={() => setDetail(null)}>
              <h3 className="text-lg font-semibold">Invoice INV-{detail.id.slice(0, 6).toUpperCase()}</h3>
              <p className="modal-panel-subtle text-sm">
                {detail.guest_name}
                {detail.roomNumber ? ` · Room ${detail.roomNumber}` : ''}
              </p>
            </ModalHeader>
            <ModalBody className="space-y-4">
              <div className="rounded-xl surface-inset p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  GRA tax breakdown
                </p>
                <div className="space-y-2 text-sm">
                  <Row label="Subtotal (room charges)" value={money(detail.subtotal)} />
                  <Row label="NHIL (2.5%)" value={money(detail.nhil_amount)} />
                  <Row label="GETFund (2.5%)" value={money(detail.getfund_amount)} />
                  <Row label="COVID-19 levy (1%)" value={money(detail.covid_levy_amount)} />
                  <Row label="VAT (15%)" value={money(detail.vat_amount)} />
                  {(detail.elevy_amount ?? 0) > 0 && <Row label="E-Levy" value={money(detail.elevy_amount)} />}
                  <div className="flex justify-between border-t border-[#E9ECEF] pt-2">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-foreground">{money(detail.total_amount)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Payment method</p>
                  <p className="mt-1 font-semibold text-foreground">{formatMethod(detail.payment_method)}</p>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Status</p>
                  <p className="mt-1 font-semibold capitalize text-foreground">{detail.payment_status ?? 'pending'}</p>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Issued</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {detail.issued_at ? new Date(detail.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Paid</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {detail.paid_at ? new Date(detail.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
            </ModalBody>
          </>
        )}
      </CenteredModal>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

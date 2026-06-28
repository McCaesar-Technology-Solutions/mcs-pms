'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Download, Plus, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { createManualInvoice, recordInvoicePayment, recordPartialInvoicePayment, refundInvoicePayment } from '@/app/actions/invoices'
import { invoiceBalanceDue } from '@/lib/billing/invoice-payments'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { CenteredModal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/centered-modal'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard } from '@/lib/export/entity-refs'
import { usePagination } from '@/lib/hooks/use-pagination'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import { PAYMENT_METHOD_LABELS, computeInvoiceTaxes, type VatMode } from '@/lib/tax'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { downloadInvoicePdf } from '@/lib/export/invoice-pdf'
import type { ExportHotelInfo } from '@/lib/export/types'
import type { InvoiceWithRoom } from '@/lib/data/billing'
import type { PaymentMethod } from '@/types'

const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'mtn_momo',
  'telecel_cash',
  'airteltigo',
  'visa',
  'mastercard',
  'bank_transfer',
]

interface BillingRow {
  id: string
  rowKey: string
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
    const balanceDue = invoiceBalanceDue(
      inv.total_amount ?? 0,
      inv.amount_paid ?? (status === 'paid' ? inv.total_amount ?? 0 : 0),
    )
    return {
      id: formatInvoiceNumber(inv),
      rowKey: inv.id,
      guestName: inv.guest_name,
      roomNumber: inv.roomNumber ?? '—',
      amount: balanceDue > 0 && status !== 'paid' ? balanceDue : inv.total_amount ?? 0,
      status,
      date: (inv.issued_at ?? new Date().toISOString()).slice(0, 10),
      dueDate: (inv.due_at ?? inv.issued_at ?? new Date().toISOString()).slice(0, 10),
      paymentMethod: formatMethod(inv.payment_method),
      invoice: inv,
    }
  })
}

function money(value: number | null | undefined) {
  return `₵${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toExportRow(inv: InvoiceWithRoom) {
  return {
    invoiceNumber: formatInvoiceNumber(inv),
    guestName: inv.guest_name,
    roomNumber: inv.roomNumber,
    checkIn: inv.checkIn,
    checkOut: inv.checkOut,
    nights: inv.nights,
    issuedAt: inv.issued_at,
    subtotal: inv.subtotal ?? 0,
    nhil: inv.nhil_amount ?? 0,
    getfund: inv.getfund_amount ?? 0,
    covid: inv.covid_levy_amount ?? 0,
    vat: inv.vat_amount ?? 0,
    elevy: inv.elevy_amount ?? 0,
    total: inv.total_amount ?? 0,
    paymentMethod: inv.payment_method,
    paymentStatus: inv.payment_status,
  }
}

interface BillingOverviewProps {
  invoices: InvoiceWithRoom[]
  hotel: ExportHotelInfo | null
  initialQuery?: string
  vatMode?: VatMode
}

export function BillingOverview({
  invoices,
  hotel,
  initialQuery = '',
  vatMode = 'exclusive',
}: BillingOverviewProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [textFilter, setTextFilter] = useState(initialQuery)
  const [detail, setDetail] = useState<InvoiceWithRoom | null>(null)
  const [creating, setCreating] = useState(false)
  const [newGuestName, setNewGuestName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newSubtotal, setNewSubtotal] = useState('')
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>('cash')
  const [newMarkPaid, setNewMarkPaid] = useState(true)
  const [partialAmount, setPartialAmount] = useState('')
  const [partialMethod, setPartialMethod] = useState<PaymentMethod>('cash')
  const [pending, startTransition] = useTransition()

  const rows: BillingRow[] = useMemo(() => mapInvoices(invoices), [invoices])

  const totalRevenue = rows.reduce((sum, inv) => sum + inv.amount, 0)
  const paidAmount = rows.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
  const pendingAmount = rows
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0)

  const collectionRate = totalRevenue > 0 ? (paidAmount / totalRevenue) * 100 : 0

  const filteredInvoices = useMemo(() => {
    const q = textFilter.trim().toLowerCase()
    return rows.filter((inv) => {
      const matchesStatus = !statusFilter || inv.status === statusFilter
      if (!q) return matchesStatus
      const matchesText =
        inv.id.toLowerCase().includes(q) ||
        inv.guestName.toLowerCase().includes(q) ||
        String(inv.roomNumber).toLowerCase().includes(q)
      return matchesStatus && matchesText
    })
  }, [rows, statusFilter, textFilter])

  const selection = useRowSelection(
    rows.map((r) => ({ ...r, id: r.rowKey })),
    filteredInvoices.map((r) => ({ ...r, id: r.rowKey })),
  )

  const pagination = usePagination(
    filteredInvoices,
    10,
    `${statusFilter ?? ''}|${textFilter}`,
  )

  function copyInvoiceRefs() {
    const refs = selection.selected.map((r) => r.id).join(', ')
    void copyToClipboard(
      refs,
      `Copied ${selection.selected.length} invoice ref${selection.selected.length === 1 ? '' : 's'}`,
    )
  }

  function exportSelectedCsv() {
    const header = ['Invoice', 'Guest', 'Room', 'Date', 'Due', 'Status', 'Method', 'Amount']
    const csvRows = selection.selected.map((r) => [
      r.id,
      r.guestName,
      String(r.roomNumber),
      r.date,
      r.dueDate,
      r.status,
      r.paymentMethod,
      String(r.amount),
    ])
    downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...csvRows])
    toast.success(`Exported ${selection.selected.length} invoice${selection.selected.length === 1 ? '' : 's'}`)
  }

  const downloadPdf = (inv: InvoiceWithRoom, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!hotel) return
    downloadInvoicePdf(hotel, toExportRow(inv))
  }

  const newSubtotalNum = parseFloat(newSubtotal) || 0
  const newTaxPreview = newSubtotalNum > 0 ? computeInvoiceTaxes(newSubtotalNum, vatMode) : null
  const amountFieldLabel =
    vatMode === 'inclusive' ? 'Gross amount (includes tax)' : 'Subtotal (before tax)'

  function submitNewInvoice() {
    startTransition(async () => {
      const result = await createManualInvoice({
        guestName: newGuestName,
        description: newDescription || undefined,
        subtotal: newSubtotalNum,
        paymentMethod: newPaymentMethod,
        markAsPaid: newMarkPaid,
      })
      if (result.success) {
        toast.success('Invoice created')
        setCreating(false)
        setNewGuestName('')
        setNewDescription('')
        setNewSubtotal('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function markPaid(inv: InvoiceWithRoom) {
    startTransition(async () => {
      const result = await recordInvoicePayment(inv.id, inv.payment_method ?? undefined)
      if (result.success) {
        toast.success('Payment recorded')
        setDetail(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function submitPartialPayment(inv: InvoiceWithRoom) {
    const amount = parseFloat(partialAmount)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount.')
      return
    }
    startTransition(async () => {
      const result = await recordPartialInvoicePayment({
        invoiceId: inv.id,
        amount,
        paymentMethod: partialMethod,
      })
      if (result.success) {
        toast.success('Partial payment recorded')
        setPartialAmount('')
        setDetail(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function submitRefund(inv: InvoiceWithRoom) {
    startTransition(async () => {
      const result = await refundInvoicePayment({ invoiceId: inv.id })
      if (result.success) {
        toast.success('Refund recorded')
        setDetail(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function invoiceOpenBalance(inv: InvoiceWithRoom): number {
    return invoiceBalanceDue(inv.total_amount ?? 0, inv.amount_paid ?? 0)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-amber-600 text-amber-50'
      case 'pending':
        return 'bg-amber-600 text-amber-50'
      case 'partial':
        return 'bg-blue-600 text-blue-50'
      case 'overdue':
        return 'bg-red-600 text-red-50'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  return (
    <>
      <BulkActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        ariaLabel="Bulk invoice actions"
        actions={[
          { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyInvoiceRefs },
          { key: 'csv', label: 'Export CSV', icon: Download, onClick: exportSelectedCsv },
        ]}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="surface-card stat-tile stat-tile-emerald p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Total Revenue</p>
          <p className="text-3xl font-bold text-foreground mt-3">₵{totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-4 text-amber-600 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground shadow-elevation-1 transition-all hover:-translate-y-0.5 hover:shadow-elevation-2 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>

        {rows.length > 0 && (
          <div className="surface-card-header border-t-0 pt-0">
            <input
              type="search"
              placeholder="Filter by invoice number, guest, or room…"
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              className="app-field max-w-md"
            />
          </div>
        )}

        <div className="surface-card-header flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusFilter(null)}
            className={`filter-pill ${statusFilter === null ? 'filter-pill--active' : ''}`}
          >
            All
          </button>
          {['paid', 'pending', 'overdue'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`filter-pill ${statusFilter === status ? 'filter-pill--active' : ''}`}
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
          {pagination.paginatedItems.map((invoice) => (
            <div
              key={invoice.rowKey}
              className={`elevated-list-item flex gap-3 p-4 ${
                selection.isSelected(invoice.rowKey) ? 'ring-2 ring-primary/25' : ''
              }`}
            >
              <BulkSelectCheckbox
                checked={selection.isSelected(invoice.rowKey)}
                onChange={() => selection.toggle(invoice.rowKey)}
                aria-label={`Select invoice ${invoice.id}`}
                className="mt-1"
              />
              <button
                type="button"
                onClick={() => invoice.invoice && setDetail(invoice.invoice)}
                className="min-w-0 flex-1 text-left"
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
            </div>
          ))}
        </div>

        <div className="hidden data-table-wrap overflow-x-auto px-4 md:block sm:px-6">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="w-10">
                  <BulkSelectCheckbox
                    checked={selection.allFilteredSelected}
                    onChange={selection.toggleAllFiltered}
                    aria-label="Select all visible invoices"
                  />
                </th>
                <th className="text-left font-semibold text-foreground">Invoice</th>
                <th className="text-left font-semibold text-foreground">Guest & Room</th>
                <th className="text-left font-semibold text-foreground">Date</th>
                <th className="text-left font-semibold text-foreground">Payment Method</th>
                <th className="text-right font-semibold text-foreground">Amount</th>
                <th className="text-center font-semibold text-foreground">Status</th>
                <th className="text-center font-semibold text-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map((invoice) => (
                <tr
                  key={invoice.rowKey}
                  className={`${invoice.invoice ? 'cursor-pointer' : ''} ${
                    selection.isSelected(invoice.rowKey) ? 'is-selected' : ''
                  }`}
                  onClick={() => invoice.invoice && setDetail(invoice.invoice)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <BulkSelectCheckbox
                      checked={selection.isSelected(invoice.rowKey)}
                      onChange={() => selection.toggle(invoice.rowKey)}
                      aria-label={`Select invoice ${invoice.id}`}
                    />
                  </td>
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
                    <button
                      type="button"
                      disabled={!hotel || !invoice.invoice}
                      title={hotel ? 'Download PDF' : 'Hotel details unavailable'}
                      onClick={(e) => invoice.invoice && downloadPdf(invoice.invoice, e)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length > 0 && (
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.setPage}
          />
        )}
      </div>

      <CenteredModal open={!!detail} onClose={() => setDetail(null)} className="max-w-md" aria-label="Invoice details">
        {detail && (
          <>
            <ModalHeader onClose={() => setDetail(null)}>
              <h3 className="text-lg font-semibold">Invoice {formatInvoiceNumber(detail)}</h3>
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
                  <p className="modal-panel-subtle text-xs">Amount paid</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {money(detail.amount_paid ?? 0)}
                  </p>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Balance due</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {money(invoiceOpenBalance(detail))}
                  </p>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Issued</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {detail.issued_at ? new Date(detail.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <div className="surface-inset rounded-xl p-3">
                  <p className="modal-panel-subtle text-xs">Paid in full</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {detail.paid_at ? new Date(detail.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>

              {hotel && (
                <button
                  type="button"
                  onClick={() => downloadPdf(detail)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              )}

              {detail.payment_status !== 'paid' &&
                detail.payment_status !== 'refunded' &&
                invoiceOpenBalance(detail) > 0 && (
                <>
                  <div className="rounded-xl surface-inset p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Record partial payment
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                        placeholder={`Max ${invoiceOpenBalance(detail)}`}
                        className="flex-1 rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
                      />
                      <select
                        value={partialMethod}
                        onChange={(e) => setPartialMethod(e.target.value as PaymentMethod)}
                        className="rounded-lg border border-[#E9ECEF] px-2 py-2 text-sm"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => submitPartialPayment(detail)}
                      className="w-full rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50"
                    >
                      Record partial payment
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => markPaid(detail)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Record full payment
                  </button>
                </>
              )}

              {(detail.amount_paid ?? 0) > 0 && detail.payment_status !== 'refunded' && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submitRefund(detail)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Issue refund
                </button>
              )}
            </ModalBody>
          </>
        )}
      </CenteredModal>

      <CenteredModal open={creating} onClose={() => setCreating(false)} className="max-w-md" aria-label="New invoice">
        <ModalHeader onClose={() => setCreating(false)}>
          <h3 className="text-lg font-semibold">New invoice</h3>
          <p className="modal-panel-subtle text-sm">Bill extras, services, or walk-in charges</p>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label className="text-sm font-semibold">Guest name</label>
            <input
              value={newGuestName}
              onChange={(e) => setNewGuestName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
              placeholder="Guest or company name"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">Description (optional)</label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
              placeholder="e.g. Laundry, minibar"
            />
          </div>
          <div>
            <label className="text-sm font-semibold">{amountFieldLabel} (GHS)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newSubtotal}
              onChange={(e) => setNewSubtotal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
            />
            {newTaxPreview && (
              <p className="mt-1 text-xs text-muted-foreground">
                Total with GRA taxes: {money(newTaxPreview.total)}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-semibold">Payment method</label>
            <select
              value={newPaymentMethod}
              onChange={(e) => setNewPaymentMethod(e.target.value as PaymentMethod)}
              className="mt-1 w-full rounded-lg border border-[#E9ECEF] px-3 py-2 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newMarkPaid}
              onChange={(e) => setNewMarkPaid(e.target.checked)}
            />
            Payment received now
          </label>
        </ModalBody>
        <ModalFooter>
          <button
            type="button"
            disabled={pending || newGuestName.trim().length < 2 || newSubtotalNum <= 0}
            onClick={submitNewInvoice}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Creating…' : 'Create invoice'}
          </button>
        </ModalFooter>
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

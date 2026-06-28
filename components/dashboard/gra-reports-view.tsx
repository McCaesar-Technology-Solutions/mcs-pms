'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Download, Eye, CheckCircle, AlertCircle, Clock, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { BulkActionBar } from '@/components/dashboard/bulk-action-bar'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { downloadGraCsv, downloadGraAllZip, downloadGraPdf } from '@/lib/export/gra-export'
import { downloadCsv } from '@/lib/export/download-csv'
import { copyToClipboard } from '@/lib/export/entity-refs'
import { usePagination } from '@/lib/hooks/use-pagination'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import type { ExportHotelInfo } from '@/lib/export/types'
import type { GraReportRow, GraReportsSummary } from '@/lib/data/gra-reports'
import type { DbInvoice } from '@/types'

interface GRAReportsViewProps {
  reports: GraReportRow[]
  summary: GraReportsSummary
  invoices: DbInvoice[]
  hotel: ExportHotelInfo | null
}

export function GRAReportsView({ reports, summary, invoices, hotel }: GRAReportsViewProps) {
  const [exportMenu, setExportMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selection = useRowSelection(reports, reports)
  const pagination = usePagination(reports)

  useEffect(() => {
    if (!exportMenu) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setExportMenu(null)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [exportMenu])

  function copyPeriodRefs() {
    void copyToClipboard(
      selection.selected.map((r) => r.id).join(', '),
      `Copied ${selection.selected.length} period ref${selection.selected.length === 1 ? '' : 's'}`,
    )
  }

  function exportSelectedSummaryCsv() {
    const header = ['Period', 'Reference', 'Revenue', 'Tax paid', 'Invoices paid', 'Invoices issued', 'Status']
    const rows = selection.selected.map((r) => [
      r.month,
      r.id,
      String(r.totalRevenue),
      String(r.taxAmount),
      String(r.invoicesPaid),
      String(r.invoicesIssued),
      r.status,
    ])
    downloadCsv(`gra-periods-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows])
    toast.success(`Exported ${selection.selected.length} period${selection.selected.length === 1 ? '' : 's'}`)
  }

  function exportSelectedDetailCsv() {
    for (const report of selection.selected) {
      downloadGraCsv(report, invoices)
    }
    toast.success(`Downloaded ${selection.selected.length} GRA CSV file${selection.selected.length === 1 ? '' : 's'}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-600 text-blue-50'
      case 'approved':
        return 'bg-amber-600 text-amber-50'
      case 'pending':
        return 'bg-amber-600 text-amber-50'
      default:
        return 'bg-gray-600 text-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5" />
      case 'pending':
        return <Clock className="h-5 w-5" />
      default:
        return <AlertCircle className="h-5 w-5" />
    }
  }

  const nextDeadlineFormatted = summary.nextDeadline
    ? new Date(summary.nextDeadline + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

  return (
    <>
      <BulkActionBar
        count={selection.selected.length}
        onClear={selection.clear}
        ariaLabel="Bulk GRA report actions"
        actions={[
          { key: 'refs', label: 'Copy refs', icon: Copy, onClick: copyPeriodRefs },
          { key: 'summary', label: 'Export summary CSV', icon: Download, onClick: exportSelectedSummaryCsv },
          { key: 'detail', label: 'Export GRA CSVs', icon: Download, onClick: exportSelectedDetailCsv },
        ]}
      />

      <div className="surface-card mb-8">
        <div className="surface-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Tax Filing Deadlines</h2>
            <p className="text-sm text-muted-foreground mt-1">Upcoming GRA compliance deadlines</p>
          </div>
          {reports.length > 0 && (
            <button
              type="button"
              onClick={() => downloadGraAllZip(reports, invoices)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" />
              Export all periods (ZIP)
            </button>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="info-block info-block-blue p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Next Deadline</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{nextDeadlineFormatted}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {summary.nextDeadlineLabel ? `${summary.nextDeadlineLabel} report` : 'No pending filings'}
            </p>
          </div>

          <div className="info-block info-block-emerald p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Compliance Status</p>
            <p className="text-2xl font-bold text-amber-600 mt-2">{summary.compliancePct}%</p>
            <p className="text-xs text-muted-foreground mt-2">Approved monthly reports</p>
          </div>

          <div className="info-block info-block-orange p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Tax Paid YTD</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              ₵{summary.taxPaidYtd.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-2">{new Date().getFullYear()} year to date</p>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Filing History</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {reports.length} period{reports.length === 1 ? '' : 's'} with invoice activity
            </p>
          </div>
          {reports.length > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <BulkSelectCheckbox
                checked={selection.allFilteredSelected}
                onChange={selection.toggleAllFiltered}
                aria-label="Select all periods"
              />
              Select all
            </label>
          )}
        </div>

        {reports.length === 0 ? (
          <div className="p-6">
            <DataEmptyState
              message="Issue paid invoices to build your GRA filing history."
              className="border-0 shadow-none"
            />
          </div>
        ) : (
          <>
          <div className="data-table-wrap overflow-x-auto px-4 sm:px-6">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <BulkSelectCheckbox
                      checked={selection.allFilteredSelected}
                      onChange={selection.toggleAllFiltered}
                      aria-label="Select all visible periods"
                    />
                  </th>
                  <th className="text-left font-semibold text-foreground">Period</th>
                  <th className="text-left font-semibold text-foreground">Total Revenue</th>
                  <th className="text-left font-semibold text-foreground">Tax Paid</th>
                  <th className="text-left font-semibold text-foreground">Invoices</th>
                  <th className="text-center font-semibold text-foreground">Status</th>
                  <th className="text-center font-semibold text-foreground" />
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((report) => (
                  <tr
                    key={report.id}
                    className={selection.isSelected(report.id) ? 'is-selected' : ''}
                  >
                    <td>
                      <BulkSelectCheckbox
                        checked={selection.isSelected(report.id)}
                        onChange={() => selection.toggle(report.id)}
                        aria-label={`Select period ${report.month}`}
                      />
                    </td>
                    <td>
                      <p className="font-semibold text-foreground">{report.month}</p>
                      <p className="text-xs text-muted-foreground">{report.id}</p>
                    </td>
                    <td>
                      <p className="font-semibold text-foreground">₵{report.totalRevenue.toLocaleString()}</p>
                    </td>
                    <td>
                      <p className="font-semibold text-foreground">₵{report.taxAmount.toLocaleString()}</p>
                    </td>
                    <td>
                      <p className="text-sm text-muted-foreground">
                        {report.invoicesPaid}/{report.invoicesIssued}
                      </p>
                    </td>
                    <td className="text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(report.status)} shadow-elevation-1`}
                      >
                        {getStatusIcon(report.status)}
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="relative inline-block" ref={exportMenu === report.id ? menuRef : undefined}>
                        <button
                          type="button"
                          onClick={() => setExportMenu(exportMenu === report.id ? null : report.id)}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-semibold text-foreground transition-colors hover:bg-secondary"
                        >
                          <Eye className="h-4 w-4" />
                          Export
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {exportMenu === report.id && (
                          <div className="modal-panel surface-card absolute right-0 z-10 mt-1 min-w-[140px] py-1 shadow-elevation-3">
                            <button
                              type="button"
                              onClick={() => {
                                downloadGraCsv(report, invoices)
                                setExportMenu(null)
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-secondary/60"
                            >
                              <Download className="h-4 w-4" />
                              CSV
                            </button>
                            <button
                              type="button"
                              disabled={!hotel}
                              onClick={() => {
                                if (hotel) downloadGraPdf(hotel, report, invoices)
                                setExportMenu(null)
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-secondary/60 disabled:opacity-40"
                            >
                              <Download className="h-4 w-4" />
                              PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.setPage}
          />
          </>
        )}
      </div>
    </>
  )
}

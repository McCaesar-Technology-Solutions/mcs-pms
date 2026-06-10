'use client'

import { Download, Eye, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { GraReportRow, GraReportsSummary } from '@/lib/data/gra-reports'

interface GRAReportsViewProps {
  reports: GraReportRow[]
  summary: GraReportsSummary
}

export function GRAReportsView({ reports, summary }: GRAReportsViewProps) {
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
      <div className="surface-card mb-8">
        <div className="surface-card-header">
          <h2 className="text-2xl font-semibold text-foreground">Tax Filing Deadlines</h2>
          <p className="text-sm text-muted-foreground mt-1">Upcoming GRA compliance deadlines</p>
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
        <div className="surface-card-header">
          <h2 className="text-2xl font-semibold text-foreground">Filing History</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {reports.length} period{reports.length === 1 ? '' : 's'} with invoice activity
          </p>
        </div>

        {reports.length === 0 ? (
          <div className="p-6">
            <DataEmptyState
              message="Issue paid invoices to build your GRA filing history."
              className="border-0 shadow-none"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Period</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Total Revenue</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Tax Paid</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Invoices</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground">Status</th>
                  <th className="text-center py-4 px-6 font-semibold text-foreground" />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-foreground">{report.month}</p>
                      <p className="text-xs text-muted-foreground">{report.id}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-foreground">₵{report.totalRevenue.toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-foreground">₵{report.taxAmount.toLocaleString()}</p>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-sm text-muted-foreground">
                        {report.invoicesPaid}/{report.invoicesIssued}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(report.status)} shadow-elevation-1`}
                      >
                        {getStatusIcon(report.status)}
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        type="button"
                        disabled
                        title="Download coming soon"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground font-semibold opacity-50 cursor-not-allowed"
                      >
                        <Eye className="h-4 w-4" />
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

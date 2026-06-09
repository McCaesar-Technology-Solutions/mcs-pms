'use client'

import { Download, Eye, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const MOCK_REPORTS = [
  {
    id: 'GRA-2026-06',
    month: 'June 2026',
    totalRevenue: 17600,
    taxAmount: 2112,
    invoicesIssued: 45,
    invoicesPaid: 43,
    status: 'submitted',
    submittedDate: '2026-06-05',
    filingDeadline: '2026-07-05',
  },
  {
    id: 'GRA-2026-05',
    month: 'May 2026',
    totalRevenue: 15200,
    taxAmount: 1824,
    invoicesIssued: 38,
    invoicesPaid: 38,
    status: 'approved',
    submittedDate: '2026-05-10',
    approvedDate: '2026-05-20',
  },
  {
    id: 'GRA-2026-04',
    month: 'April 2026',
    totalRevenue: 14800,
    taxAmount: 1776,
    invoicesIssued: 35,
    invoicesPaid: 35,
    status: 'approved',
    submittedDate: '2026-04-15',
    approvedDate: '2026-04-25',
  },
]

export function GRAReportsView() {
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
            <p className="text-2xl font-bold text-blue-600 mt-2">July 5, 2026</p>
            <p className="text-xs text-muted-foreground mt-2">June 2026 report</p>
          </div>

          <div className="info-block info-block-emerald p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Compliance Status</p>
            <p className="text-2xl font-bold text-amber-600 mt-2">100%</p>
            <p className="text-xs text-muted-foreground mt-2">All filings current</p>
          </div>

          <div className="info-block info-block-orange p-4">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Tax Paid YTD</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">₵11,712</p>
            <p className="text-xs text-muted-foreground mt-2">2026 year to date</p>
          </div>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="surface-card-header">
          <h2 className="text-2xl font-semibold text-foreground">Filing History</h2>
          <p className="text-sm text-muted-foreground mt-1">{MOCK_REPORTS.length} submitted reports</p>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Period</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Total Revenue</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Tax Paid</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Invoices</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Status</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {MOCK_REPORTS.map((report) => (
                <tr key={report.id}>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground">{report.month}</p>
                    <p className="text-xs text-muted-foreground">{report.id}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground">₵{report.totalRevenue}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-foreground">₵{report.taxAmount}</p>
                  </td>
                  <td className="py-4 px-6">
                    <p className="text-sm text-muted-foreground">{report.invoicesPaid}/{report.invoicesIssued}</p>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-semibold ${getStatusColor(report.status)} shadow-elevation-1`}>
                      {getStatusIcon(report.status)}
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground font-semibold">
                      <Eye className="h-4 w-4" />
                      <Download className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

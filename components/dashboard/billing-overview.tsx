'use client'

import { useState } from 'react'
import { Calendar, Download, Filter, Plus, TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react'

const MOCK_INVOICES = [
  {
    id: 'INV-001',
    guestName: 'Ama Mensah',
    roomNumber: 302,
    amount: 1200,
    status: 'paid',
    date: '2026-06-01',
    dueDate: '2026-06-05',
    paymentMethod: 'Credit Card',
  },
  {
    id: 'INV-002',
    guestName: 'Kwame Asante',
    roomNumber: 215,
    amount: 850,
    status: 'pending',
    date: '2026-06-03',
    dueDate: '2026-06-08',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'INV-003',
    guestName: 'Abena Osei',
    roomNumber: 401,
    amount: 2100,
    status: 'paid',
    date: '2026-05-28',
    dueDate: '2026-06-02',
    paymentMethod: 'Cash',
  },
  {
    id: 'INV-004',
    guestName: 'Kofi Boateng',
    roomNumber: 308,
    amount: 950,
    status: 'overdue',
    date: '2026-05-20',
    dueDate: '2026-05-25',
    paymentMethod: 'Pending',
  },
  {
    id: 'INV-005',
    guestName: 'Nana Acheampong',
    roomNumber: 105,
    amount: 650,
    status: 'pending',
    date: '2026-06-04',
    dueDate: '2026-06-09',
    paymentMethod: 'Mobile Money',
  },
]

export function BillingOverview() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  const totalRevenue = MOCK_INVOICES.reduce((sum, inv) => sum + inv.amount, 0)
  const paidAmount = MOCK_INVOICES.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0)
  const pendingAmount = MOCK_INVOICES.filter((inv) => inv.status === 'pending' || inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0)

  const filteredInvoices = statusFilter
    ? MOCK_INVOICES.filter((inv) => inv.status === statusFilter)
    : MOCK_INVOICES

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-600 text-emerald-50'
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
          <div className="flex items-center gap-2 mt-4 text-emerald-600 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            June 2026
          </div>
        </div>

        <div className="surface-card stat-tile stat-tile-blue p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Paid Invoices</p>
          <p className="text-3xl font-bold text-foreground mt-3">₵{paidAmount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{MOCK_INVOICES.filter((inv) => inv.status === 'paid').length} invoices</p>
        </div>

        <div className="surface-card stat-tile stat-tile-amber p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Pending Invoices</p>
          <p className="text-3xl font-bold text-foreground mt-3">₵{pendingAmount.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{MOCK_INVOICES.filter((inv) => inv.status === 'pending' || inv.status === 'overdue').length} invoices</p>
        </div>

        <div className="surface-card stat-tile stat-tile-purple p-6">
          <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Collection Rate</p>
          <p className="text-3xl font-bold text-foreground mt-3">{Math.round((paidAmount / totalRevenue) * 100)}%</p>
          <div className="w-full bg-secondary rounded-full h-2 mt-4">
            <div
              className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all"
              style={{ width: `${(paidAmount / totalRevenue) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="surface-card">
        <div className="surface-card-header flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Invoices</h2>
            <p className="text-sm text-muted-foreground mt-1">{filteredInvoices.length} invoices</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold shadow-elevation-1 hover:shadow-elevation-2 transition-all hover:-translate-y-0.5">
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>

        <div className="surface-card-header flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              statusFilter === null
                ? 'bg-primary text-primary-foreground shadow-elevation-1'
                : 'bg-secondary text-foreground hover:bg-secondary/80'
            }`}
          >
            All
          </button>
          {['paid', 'pending', 'overdue'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground shadow-elevation-1'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
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
                <tr key={invoice.id}>
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
                    <p className="font-bold text-foreground">₵{invoice.amount}</p>
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
    </>
  )
}

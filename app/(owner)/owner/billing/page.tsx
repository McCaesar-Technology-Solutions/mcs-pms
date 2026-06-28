import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PaymentReconciliationPanel } from '@/components/dashboard/payment-reconciliation-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { getInvoicesData } from '@/lib/data/billing'
import { getPaymentRecordsData, getPaymentReconciliationSummary } from '@/lib/data/payments'
import { getHotelExportInfo } from '@/lib/data/settings'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [invoices, hotel, paymentSummary, paymentRecords] = await Promise.all([
    getInvoicesData(),
    getHotelExportInfo(),
    getPaymentReconciliationSummary(),
    getPaymentRecordsData(50),
  ])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Finance"
        title="Billing & Invoices"
        description="Manage invoices, reconcile payments, and monitor revenue collection."
      />

      <PageTabShell
        defaultTab="invoices"
        tabs={[
          { id: 'invoices', label: 'Invoices' },
          { id: 'reconciliation', label: 'Payment ledger' },
        ]}
        panels={{
          invoices: (
            <BillingOverview
              invoices={invoices}
              hotel={hotel}
              initialQuery={q}
              vatMode={hotel?.vatMode ?? 'exclusive'}
            />
          ),
          reconciliation: (
            <PaymentReconciliationPanel summary={paymentSummary} records={paymentRecords} />
          ),
        }}
      />
    </div>
  )
}

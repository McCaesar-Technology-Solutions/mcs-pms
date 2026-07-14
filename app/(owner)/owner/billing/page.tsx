import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PaymentReconciliationPanel } from '@/components/dashboard/payment-reconciliation-panel'
import { OnlinePaymentsPanel } from '@/components/dashboard/online-payments-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { getInvoicesData } from '@/lib/data/billing'
import { getPaymentRecordsData, getPaymentReconciliationSummary } from '@/lib/data/payments'
import { getOnlinePaymentsData } from '@/lib/data/online-payments'
import { getHotelExportInfo } from '@/lib/data/settings'
import { isPaymentsEnabled } from '@/lib/payments/enabled'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>
}) {
  const { q, open } = await searchParams
  const paymentsEnabled = isPaymentsEnabled()
  const [invoices, hotel, paymentSummary, paymentRecords, onlinePayments] = await Promise.all([
    getInvoicesData(),
    getHotelExportInfo(),
    getPaymentReconciliationSummary(),
    getPaymentRecordsData(50),
    getOnlinePaymentsData(100),
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
          { id: 'online', label: 'Online payments' },
        ]}
        panels={{
          invoices: (
            <BillingOverview
              invoices={invoices}
              hotel={hotel}
              initialQuery={q}
              openInvoiceId={open}
              vatMode={hotel?.vatMode ?? 'exclusive'}
              onlinePaymentsEnabled={paymentsEnabled}
            />
          ),
          reconciliation: (
            <PaymentReconciliationPanel summary={paymentSummary} records={paymentRecords} />
          ),
          online: <OnlinePaymentsPanel payments={onlinePayments} enabled={paymentsEnabled} />,
        }}
      />
    </div>
  )
}

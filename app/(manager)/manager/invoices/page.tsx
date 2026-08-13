import { BillingOverview } from '@/components/dashboard/billing-overview'
import { OnlinePaymentsPanel } from '@/components/dashboard/online-payments-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { getInvoicesData } from '@/lib/data/billing'
import { getOnlinePaymentsData } from '@/lib/data/online-payments'
import { getHotelExportInfo } from '@/lib/data/settings'
import { isPaymentsEnabled } from '@/lib/payments/enabled'

export default async function ManagerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>
}) {
  const { q, open } = await searchParams
  const paymentsEnabled = isPaymentsEnabled()
  const [invoices, hotel, onlinePayments] = await Promise.all([
    getInvoicesData(),
    getHotelExportInfo(),
    getOnlinePaymentsData(100),
  ])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Finance"
        title="Billing"
        description="Issue stay invoices, create unpaid or paid bills, record payments, and print guest bills. Refunds stay with the owner."
      />

      <PageTabShell
        defaultTab="invoices"
        tabs={[
          { id: 'invoices', label: 'Invoices' },
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
              canRecordPayment
              canCreateInvoice
              canRefund={false}
              onlinePaymentsEnabled={paymentsEnabled}
            />
          ),
          online: <OnlinePaymentsPanel payments={onlinePayments} enabled={paymentsEnabled} />,
        }}
      />
    </div>
  )
}

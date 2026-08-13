import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PageHeader } from '@/components/dashboard/page-header'
import { getInvoicesData } from '@/lib/data/billing'
import { getHotelExportInfo } from '@/lib/data/settings'
import { isPaymentsEnabled } from '@/lib/payments/enabled'

export default async function ReceptionistBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>
}) {
  const { q, open } = await searchParams
  const paymentsEnabled = isPaymentsEnabled()
  const [invoices, hotel] = await Promise.all([getInvoicesData(), getHotelExportInfo()])

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Finance"
        title="Billing"
        description="Issue stay invoices, record payments, and share guest bills. Refunds and ad-hoc invoices stay with the owner."
      />

      <BillingOverview
        invoices={invoices}
        hotel={hotel}
        initialQuery={q}
        openInvoiceId={open}
        vatMode={hotel?.vatMode ?? 'exclusive'}
        canRecordPayment
        canCreateInvoice={false}
        canRefund={false}
        onlinePaymentsEnabled={paymentsEnabled}
      />
    </div>
  )
}

import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PageHeader } from '@/components/dashboard/page-header'
import { getInvoicesData } from '@/lib/data/billing'
import { getHotelExportInfo } from '@/lib/data/settings'
import { isPaystackConfigured } from '@/lib/payments/paystack'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; paid?: string; payment_error?: string }>
}) {
  const { q, paid, payment_error: paymentError } = await searchParams
  const [invoices, hotel] = await Promise.all([getInvoicesData(), getHotelExportInfo()])

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Finance"
        title="Billing & Invoices"
        description="Manage invoices, track payments, and monitor revenue collection."
      />

      <BillingOverview
        invoices={invoices}
        hotel={hotel}
        initialQuery={q}
        vatMode={hotel?.vatMode ?? 'exclusive'}
        paystackEnabled={isPaystackConfigured()}
        paymentNotice={paid ? 'paid' : paymentError ? 'error' : undefined}
        paymentError={paymentError}
      />
    </div>
  )
}

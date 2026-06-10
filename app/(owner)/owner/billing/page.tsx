import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PageHeader } from '@/components/dashboard/page-header'
import { getInvoicesData } from '@/lib/data/billing'

export default async function BillingPage() {
  const invoices = await getInvoicesData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Finance"
        title="Billing & Invoices"
        description="Manage invoices, track payments, and monitor revenue collection."
      />

      <BillingOverview invoices={invoices} />
    </div>
  )
}

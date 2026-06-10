import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function BillingPage() {
  const { invoices } = await getDashboardData()

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

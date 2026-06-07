import { BillingOverview } from '@/components/dashboard/billing-overview'
import { PageHeader } from '@/components/dashboard/page-header'

export default function BillingPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Finance"
        title="Billing & Invoices"
        description="Manage invoices, track payments, and monitor revenue collection."
      />

      <BillingOverview />
    </div>
  )
}

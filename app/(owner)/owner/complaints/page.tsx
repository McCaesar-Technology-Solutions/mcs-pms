import { ComplaintsOwnerView } from '@/components/complaints/complaints-owner-view'
import { PageHeader } from '@/components/dashboard/page-header'

export default function OwnerComplaintsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Operations"
        title="Complaints"
        description="Full visibility into guest issues, technician invoices, and resolution progress."
      />
      <ComplaintsOwnerView />
    </div>
  )
}

import { ComplaintsOwnerView } from '@/components/complaints/complaints-owner-view'
import { PageHeader } from '@/components/dashboard/page-header'

export default function ReceptionistComplaintsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Operations"
        title="Complaints"
        description="Log issues for guests and follow their progress through to resolution."
      />
      <ComplaintsOwnerView canLog />
    </div>
  )
}

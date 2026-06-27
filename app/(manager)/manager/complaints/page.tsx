import { ComplaintsManager } from '@/components/complaints/complaints-manager'
import { PageHeader } from '@/components/dashboard/page-header'

export default function ManagerComplaintsPage() {
  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Operations"
        title="Complaints"
        description="Track guest issues, assign technicians, and approve completed work."
      />
      <ComplaintsManager />
    </div>
  )
}

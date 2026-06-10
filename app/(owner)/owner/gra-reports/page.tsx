import { GRAReportsView } from '@/components/dashboard/gra-reports-view'
import { PageHeader } from '@/components/dashboard/page-header'

export default function GRAReportsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Compliance"
        title="GRA Tax Reports"
        description="View tax filing status, compliance deadlines, and download reports for Ghana Revenue Authority."
      />

      <GRAReportsView />
    </div>
  )
}

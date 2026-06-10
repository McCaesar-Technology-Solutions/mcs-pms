import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'
import { PageHeader } from '@/components/dashboard/page-header'

export default function AnalyticsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Insights"
        title="Analytics"
        description="Track key performance metrics, revenue trends, and guest satisfaction scores."
      />

      <AnalyticsDashboard />
    </div>
  )
}

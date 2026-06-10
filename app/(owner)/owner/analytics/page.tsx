import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { computeAnalytics } from '@/lib/data/analytics'

export default async function AnalyticsPage() {
  const { reservations, metrics } = await getDashboardData()
  const analytics = computeAnalytics(reservations, metrics)

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Insights"
        title="Analytics"
        description="Track key performance metrics, revenue trends, and guest satisfaction scores."
      />

      <AnalyticsDashboard data={analytics} />
    </div>
  )
}

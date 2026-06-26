import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'
import { PageHeader } from '@/components/dashboard/page-header'
import { computeAnalytics } from '@/lib/data/analytics'
import { getDashboardData } from '@/lib/data/dashboard'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { computeChannelPerformance } from '@/lib/data/overview'

export default async function AnalyticsPage() {
  const { reservations, metrics, invoices, hotelId } = await getDashboardData()
  const guestFeedback = hotelId ? await loadHotelGuestFeedback(hotelId, 50) : null

  const analytics = computeAnalytics({
    reservations,
    metrics,
    invoices,
    channels: computeChannelPerformance(reservations),
    guestFeedback: guestFeedback
      ? { averageRating: guestFeedback.averageRating, totalCount: guestFeedback.totalCount }
      : undefined,
  })

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Insights"
        title="Analytics"
        description="Revenue, occupancy, booking channels, and guest satisfaction — updated from your live reservation and billing data."
      />

      <AnalyticsDashboard data={analytics} />
    </div>
  )
}

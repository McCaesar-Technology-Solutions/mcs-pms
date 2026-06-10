import { KPICards } from '@/components/dashboard/kpi-cards'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { TasksList } from '@/components/dashboard/tasks-list'
import { ChannelPerformanceWidget } from '@/components/dashboard/channel-performance'
import { GRATaxSummary } from '@/components/dashboard/gra-tax-summary'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function DashboardPage() {
  const { metrics, availability } = await getDashboardData()

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        badge="Overview"
        title="Dashboard"
        description="Welcome back. Track your property performance, occupancy, revenue, and operational tasks in one place."
      />

      <section className="space-y-4">
        <SectionHeading title="Key Metrics" description="Real-time overview of your performance" />
        <KPICards metrics={metrics} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Room Availability" description="See how many rooms are free to sell over the next 14 days" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AvailabilityStrip data={availability} />
          </div>
          <div>
            <BookingsList />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Operations" description="Housekeeping and maintenance tasks" />
        <TasksList />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Business Intelligence" description="Revenue sources and tax compliance" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChannelPerformanceWidget />
          <GRATaxSummary />
        </div>
      </section>
    </div>
  )
}

import { KPICards } from '@/components/dashboard/kpi-cards'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { TasksList } from '@/components/dashboard/tasks-list'
import { ChannelPerformanceWidget } from '@/components/dashboard/channel-performance'
import { GRATaxSummary } from '@/components/dashboard/gra-tax-summary'
import { GuestFeedbackPanel } from '@/components/dashboard/guest-feedback-panel'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getDashboardData } from '@/lib/data/dashboard'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import { computeChannelPerformance, computeGraSummary } from '@/lib/data/overview'
import { getRecentNightAudits } from '@/app/actions/night-audit'
import { NightAuditPanel } from '@/components/dashboard/night-audit-panel'
import { todayISO } from '@/lib/stays/helpers'

export default async function DashboardPage() {
  const [{ metrics, availability, reservations, invoices, hotelId }, tasks, nightAudits] =
    await Promise.all([
      getDashboardData(),
      getHousekeepingTasks(),
      getRecentNightAudits(),
    ])
  const guestFeedback = hotelId ? await loadHotelGuestFeedback(hotelId) : null
  const channels = computeChannelPerformance(reservations)
  const graSummary = computeGraSummary(invoices)
  const businessDate = todayISO()
  const todayClosed = nightAudits.some((a) => a.business_date === businessDate)

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        badge="Overview"
        title="Dashboard"
        description="Occupancy, revenue, housekeeping, and guest feedback at a glance."
      />

      <section className="space-y-4">
        <SectionHeading title="Key metrics" description="Real-time overview of your performance" />
        <KPICards metrics={metrics} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Room availability" description="See how many rooms are free to sell over the next 14 days" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AvailabilityStrip data={availability} />
          </div>
          <div>
            <BookingsList reservations={reservations} viewAllHref="/owner/reservations" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading title="Operations" description="Housekeeping and maintenance tasks" />
          <Link
            href="/owner/housekeeping"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80"
          >
            Housekeeping board
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <TasksList tasks={tasks} housekeepingHref="/owner/housekeeping" />
      </section>

      {guestFeedback && (
        <section className="space-y-4">
          <SectionHeading title="Guest reviews" description="Feedback from the guest portal" />
          <GuestFeedbackPanel summary={guestFeedback} />
        </section>
      )}

      <section className="space-y-4">
        <SectionHeading title="Business intelligence" description="Revenue sources and tax compliance" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChannelPerformanceWidget channels={channels} />
          <GRATaxSummary summary={graSummary} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="End of day" description="Night audit and business date close" />
        <NightAuditPanel audits={nightAudits} todayClosed={todayClosed} />
      </section>
    </div>
  )
}

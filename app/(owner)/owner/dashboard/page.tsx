import { KPICards } from '@/components/dashboard/kpi-cards'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { TasksList } from '@/components/dashboard/tasks-list'
import { ChannelPerformanceWidget } from '@/components/dashboard/channel-performance'
import { GRATaxSummary } from '@/components/dashboard/gra-tax-summary'
import { GuestFeedbackPanel } from '@/components/dashboard/guest-feedback-panel'
import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { SectionHeading } from '@/components/dashboard/section-heading'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getDashboardData } from '@/lib/data/dashboard'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import {
  computeBookingsSparkline,
  computeChannelPerformance,
  computeGraSummary,
  computeRevenueSparkline,
  computeTodayOperations,
  computeRevenueTrend,
} from '@/lib/data/overview'
import { getOccupancyToday } from '@/lib/data/occupancy'
import { getRecentNightAudits } from '@/app/actions/night-audit'
import { NightAuditPanel } from '@/components/dashboard/night-audit-panel'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/stays/helpers'

export default async function DashboardPage() {
  const [{ metrics, availability, reservations, invoices, hotelId }, tasks, nightAudits] =
    await Promise.all([
      getDashboardData(),
      getHousekeepingTasks(),
      getRecentNightAudits(),
    ])

  const supabase = await createClient()
  const [guestFeedback, occupancyToday] = await Promise.all([
    hotelId ? loadHotelGuestFeedback(hotelId) : null,
    hotelId ? getOccupancyToday(supabase, hotelId) : undefined,
  ])

  const channels = computeChannelPerformance(reservations)
  const graSummary = computeGraSummary(invoices)
  const todayOps = computeTodayOperations(reservations)
  const revenueTrend = computeRevenueTrend(invoices)
  const revenueSparkline = computeRevenueSparkline(invoices)
  const bookingsSparkline = computeBookingsSparkline(reservations)
  const businessDate = todayISO()
  const todayClosed = nightAudits.some((a) => a.business_date === businessDate)

  return (
    <div className="page-shell pb-10">
      <DashboardHero>
        <DashboardToolbar occupancy={occupancyToday} today={todayOps} />
        <DashboardAttention today={todayOps} metrics={metrics} />
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
        <section className="dashboard-section space-y-5">
          <SectionHeading title="Business overview" description="Last 30 days" />
          <KPICards
            metrics={metrics}
            revenueTrend={revenueTrend}
            revenueSparkline={revenueSparkline}
            bookingsSparkline={bookingsSparkline}
            aside={
              <BookingsList
                reservations={reservations}
                viewAllHref="/owner/reservations"
                compact
              />
            }
          />
        </section>

        <section className="dashboard-section space-y-5">
          <SectionHeading title="Room availability" description="Next 14 days" />
          <AvailabilityStrip data={availability} />
        </section>

        <section className="dashboard-section space-y-4">
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
          <section className="dashboard-section space-y-4">
            <SectionHeading title="Guest reviews" description="Feedback from the guest portal" />
            <GuestFeedbackPanel summary={guestFeedback} />
          </section>
        )}

        <section className="dashboard-section space-y-4">
          <SectionHeading title="Business intelligence" description="Revenue sources and tax compliance" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChannelPerformanceWidget channels={channels} />
            <GRATaxSummary summary={graSummary} />
          </div>
        </section>

        <section className="dashboard-section space-y-4">
          <SectionHeading title="End of day" description="Night audit and business date close" />
          <div className="night-audit-shell">
            <NightAuditPanel audits={nightAudits} todayClosed={todayClosed} />
          </div>
        </section>
      </div>
    </div>
  )
}

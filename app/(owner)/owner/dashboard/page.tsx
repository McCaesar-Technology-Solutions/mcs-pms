import { KPICards } from '@/components/dashboard/kpi-cards'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { GuestFeedbackPanel } from '@/components/dashboard/guest-feedback-panel'
import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardMoreLinks } from '@/components/dashboard/dashboard-more-links'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { OperationsSummary } from '@/components/dashboard/operations-summary'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { getDashboardData } from '@/lib/data/dashboard'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import { countOverdueTasks } from '@/lib/housekeeping/task-view'
import { FrontDeskOpsSection } from '@/components/dashboard/front-desk-ops-section'
import { parseOpsDate } from '@/lib/dates/ops-date'
import { loadFrontDeskOpsContext } from '@/lib/data/load-front-desk-ops'
import {
  computeBookingsSparkline,
  computeOccupancySparkline,
  computeRevenueSparkline,
  computeRevenueTrend,
  computeTodayOperations,
} from '@/lib/data/overview'
import { getOccupancyToday } from '@/lib/data/occupancy'
import { getRecentNightAudits } from '@/app/actions/night-audit'
import { NightAuditPanel } from '@/components/dashboard/night-audit-panel'
import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/stays/helpers'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ opsDate?: string }>
}) {
  const { opsDate: opsDateParam } = await searchParams
  const frontDesk = await loadFrontDeskOpsContext(opsDateParam)
  const opsDate = frontDesk?.opsDate ?? parseOpsDate(opsDateParam)

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

  const todayOps =
    frontDesk?.ops ??
    ({
      ...computeTodayOperations(reservations),
      dirtyRooms: 0,
      guestRequests: 0,
      unreadMessages: 0,
      prepaidArrivals: 0,
      vacantRooms: 0,
      maintenanceRooms: 0,
    } as const)
  const revenueTrend = computeRevenueTrend(invoices)
  const revenueSparkline = computeRevenueSparkline(invoices)
  const bookingsSparkline = computeBookingsSparkline(reservations)
  const occupancySparkline = computeOccupancySparkline(availability)
  const overdueTasks = countOverdueTasks(tasks.filter((t) => t.status !== 'done'))
  const businessDate = todayISO()
  const todayClosed = nightAudits.some((a) => a.business_date === businessDate)

  return (
    <div className="page-shell dashboard-launchpad pb-8">
      <DashboardHero>
        <DashboardToolbar
          occupancy={occupancyToday}
          today={todayOps}
          opsDate={opsDate}
          showOpsDateSelector
        />
        <DashboardAttention
          today={todayOps}
          metrics={metrics}
          overdueTasks={overdueTasks}
        />
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
        <section className="dashboard-section dashboard-section--compact">
          <FrontDeskOpsSection routePrefix="/owner" opsDateParam={opsDateParam} title="Property operations" />
        </section>
        <section className="dashboard-section dashboard-section--featured">
          <SectionHeading prominent title="Business overview" />
          <KPICards
            metrics={metrics}
            revenueTrend={revenueTrend}
            revenueSparkline={revenueSparkline}
            bookingsSparkline={bookingsSparkline}
            occupancyToday={occupancyToday}
            occupancySparkline={occupancySparkline}
            compactMetrics
            aside={
              <BookingsList
                reservations={reservations}
                viewAllHref="/owner/reservations"
                compact
              />
            }
          />
        </section>

        <section className="dashboard-section dashboard-section--compact">
          <OperationsSummary tasks={tasks} />
        </section>

        <DashboardMoreLinks
          showGuestReviews={Boolean(guestFeedback)}
          showNightAudit
          todayClosed={todayClosed}
        />

        <div className="dashboard-below-fold">
          {guestFeedback && (
            <section id="guest-feedback" className="dashboard-section dashboard-section--compact scroll-mt-24">
              <SectionHeading title="Guest reviews" />
              <GuestFeedbackPanel summary={guestFeedback} />
            </section>
          )}

          <section id="night-audit" className="dashboard-section dashboard-section--compact scroll-mt-24">
            <SectionHeading title="End of day" />
            <NightAuditPanel audits={nightAudits} todayClosed={todayClosed} />
          </section>
        </div>
      </div>
    </div>
  )
}

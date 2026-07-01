import { KPICards } from '@/components/dashboard/kpi-cards'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { GuestFeedbackPanel } from '@/components/dashboard/guest-feedback-panel'
import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardMoreLinks } from '@/components/dashboard/dashboard-more-links'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { OperationsSummary } from '@/components/dashboard/operations-summary'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { getDashboardData } from '@/lib/data/dashboard'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import { countOverdueTasks } from '@/lib/housekeeping/task-view'
import { FrontDeskOpsSection } from '@/components/dashboard/front-desk-ops-section'
import { RoleWayfindingPanel } from '@/components/dashboard/role-wayfinding-panel'
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
import {
  getPeriodAudits,
  isCurrentMonthAuditClosed,
  isCurrentYearAuditClosed,
} from '@/app/actions/period-audit'
import { PeriodAuditsSection } from '@/components/dashboard/period-audits-section'
import { OpsCalendarPanel } from '@/components/dashboard/ops-calendar-panel'
import { createClient } from '@/lib/supabase/server'
import { loadOpsCalendarEvents, opsCalendarWeekRange } from '@/lib/data/ops-calendar'
import { todayISO } from '@/lib/stays/helpers'

const OWNER_HASH_TO_TAB: Record<string, string> = {
  'guest-feedback': 'guest-reviews',
  'guest-reviews': 'guest-reviews',
  'night-audit': 'night-audit',
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ opsDate?: string }>
}) {
  const { opsDate: opsDateParam } = await searchParams
  const frontDesk = await loadFrontDeskOpsContext(opsDateParam)
  const opsDate = frontDesk?.opsDate ?? parseOpsDate(opsDateParam)

  const [{ metrics, availability, reservations, invoices, hotelId }, tasks, nightAudits, monthlyAudits, yearlyAudits, monthClosed, yearClosed] =
    await Promise.all([
      getDashboardData(),
      getHousekeepingTasks(),
      getRecentNightAudits(),
      getPeriodAudits('monthly'),
      getPeriodAudits('yearly'),
      isCurrentMonthAuditClosed(),
      isCurrentYearAuditClosed(),
    ])

  const { fromIso, toIso } = opsCalendarWeekRange()
  const opsCalendarEvents = hotelId
    ? await loadOpsCalendarEvents(hotelId, fromIso, toIso)
    : []

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
    <div className="page-shell dashboard-launchpad page-shell--dashboard pb-8">
      <DashboardHero>
        <DashboardToolbar
          occupancy={occupancyToday}
          today={todayOps}
          opsDate={opsDate}
        />
        <DashboardAttention
          today={todayOps}
          metrics={metrics}
          overdueTasks={overdueTasks}
        />
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
        <RoleWayfindingPanel role="owner" />
        <section className="dashboard-section dashboard-section--compact">
          <FrontDeskOpsSection routePrefix="/owner" opsDateParam={opsDateParam} title="Property operations" />
        </section>

        <PageTabShell
          hashToTab={OWNER_HASH_TO_TAB}
          defaultTab="overview"
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'guest-reviews', label: 'Guest reviews' },
            {
              id: 'night-audit',
              label: 'Audits',
              badge: todayClosed && monthClosed && yearClosed ? undefined : 1,
            },
          ]}
          panels={{
            overview: (
              <>
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
                <OpsCalendarPanel events={opsCalendarEvents} canManage />
                <DashboardMoreLinks />
              </>
            ),
            'guest-reviews': guestFeedback ? (
              <section id="guest-reviews" className="dashboard-section scroll-mt-24">
                <SectionHeading
                  title="Guest reviews"
                  description="Feedback submitted from the guest portal"
                />
                <GuestFeedbackPanel summary={guestFeedback} />
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">No guest feedback yet.</p>
            ),
            'night-audit': (
              <section id="night-audit" className="dashboard-section scroll-mt-24">
                <SectionHeading
                  title="Period audits"
                  description="Night, monthly, and yearly closes for operational and revenue snapshots"
                />
                <PeriodAuditsSection
                  nightAudits={nightAudits}
                  monthlyAudits={monthlyAudits}
                  yearlyAudits={yearlyAudits}
                  todayClosed={todayClosed}
                  monthClosed={monthClosed}
                  yearClosed={yearClosed}
                />
              </section>
            ),
          }}
        />
      </div>
    </div>
  )
}

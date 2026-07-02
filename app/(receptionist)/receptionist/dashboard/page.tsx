import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { TodayGuestStrip } from '@/components/dashboard/today-guest-strip'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { FrontDeskOpsSection } from '@/components/dashboard/front-desk-ops-section'
import { GuestRequestsPanel } from '@/components/dashboard/guest-requests-panel'
import { RoleWayfindingPanel } from '@/components/dashboard/role-wayfinding-panel'
import { loadHotelGuestRequests } from '@/lib/data/guest-portal'
import { parseOpsDate } from '@/lib/dates/ops-date'
import { loadFrontDeskOpsContext } from '@/lib/data/load-front-desk-ops'
import {
  computeTodayOperations,
  getTodayArrivals,
  getTodayDepartures,
} from '@/lib/data/overview'
import { getOccupancyToday } from '@/lib/data/occupancy'
import { OpsCalendarPanel } from '@/components/dashboard/ops-calendar-panel'
import { loadOpsCalendarEvents, opsCalendarWeekRange } from '@/lib/data/ops-calendar'
import { createClient } from '@/lib/supabase/server'

const RECEPTIONIST_HASH_TO_TAB: Record<string, string> = {
  'guest-requests': 'requests',
}

export default async function ReceptionistDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ opsDate?: string }>
}) {
  const { opsDate: opsDateParam } = await searchParams
  const frontDesk = await loadFrontDeskOpsContext(opsDateParam)
  const opsDate = frontDesk?.opsDate ?? parseOpsDate(opsDateParam)

  const [complaints, { metrics, reservations, hotelId }] = await Promise.all([
    fetchHotelComplaints(),
    getDashboardData(),
  ])

  const supabase = await createClient()
  const occupancyToday = hotelId ? await getOccupancyToday(supabase, hotelId) : undefined
  const todayOps =
    frontDesk?.ops ??
    ({
      ...computeTodayOperations(reservations, opsDate),
      dirtyRooms: 0,
      guestRequests: 0,
      unreadMessages: 0,
      prepaidArrivals: 0,
      vacantRooms: 0,
      maintenanceRooms: 0,
    } as const)
  const arrivals = getTodayArrivals(reservations, opsDate)
  const departures = getTodayDepartures(reservations, opsDate)
  const guestRequests = hotelId ? await loadHotelGuestRequests(hotelId) : []
  const { fromIso, toIso } = opsCalendarWeekRange()
  const opsCalendarEvents = hotelId
    ? await loadOpsCalendarEvents(hotelId, fromIso, toIso)
    : []
  const pendingRequests = guestRequests.filter((r) => r.status === 'pending').length
  const openComplaints = complaints.filter((c) => c.status !== 'resolved').length

  return (
    <div className="page-shell page-shell--dashboard pb-10">
      <DashboardHero>
        <DashboardToolbar
          title="Reception dashboard"
          eyebrow="Front desk"
          occupancy={occupancyToday}
          today={todayOps}
          opsDate={opsDate}
        />
        <DashboardAttention
          today={todayOps}
          metrics={metrics}
          reservationsHref="/receptionist/reservations"
          billingHref="/receptionist/reservations"
        />
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
        <RoleWayfindingPanel role="receptionist" />
        <section className="dashboard-section dashboard-section--compact">
          <FrontDeskOpsSection
            routePrefix="/receptionist"
            opsDateParam={opsDateParam}
            initialContext={frontDesk}
          />
        </section>

        <PageTabShell
          hashToTab={RECEPTIONIST_HASH_TO_TAB}
          defaultTab="today"
          tabs={[
            { id: 'today', label: 'Today' },
            { id: 'requests', label: 'Requests', badge: pendingRequests || undefined },
            { id: 'issues', label: 'Issues', badge: openComplaints || undefined },
          ]}
          panels={{
            today: (
              <>
                <section className="dashboard-section space-y-4">
                  <SectionHeading title="Today on the desk" description="Arrivals and departures" />
                  <TodayGuestStrip
                    arrivals={arrivals}
                    departures={departures}
                    reservationsHref="/receptionist/reservations"
                  />
                </section>
                <OpsCalendarPanel events={opsCalendarEvents} />
              </>
            ),
            requests:
              hotelId ? (
                <section id="guest-requests" className="dashboard-section scroll-mt-24">
                  <GuestRequestsPanel
                    hotelId={hotelId}
                    initialRequests={guestRequests}
                    reservationsHrefBase="/receptionist/reservations"
                  />
                </section>
              ) : (
                <p className="text-sm text-muted-foreground">No property linked.</p>
              ),
            issues: (
              <section className="dashboard-section space-y-4">
                <SectionHeading title="Guest issues" description="Recent complaints needing follow-up" />
                <ComplaintsOverviewLive
                  initialComplaints={complaints}
                  limit={8}
                  complaintsHref="/receptionist/complaints"
                />
              </section>
            ),
          }}
        />
      </div>
    </div>
  )
}

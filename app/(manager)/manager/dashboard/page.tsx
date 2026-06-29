import { KPICards } from '@/components/dashboard/kpi-cards'
import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { TasksList } from '@/components/dashboard/tasks-list'
import { NotificationLogPanel } from '@/components/dashboard/notification-log-panel'
import { AuditLogPanel } from '@/components/dashboard/audit-log-panel'
import { GuestRulesPanel } from '@/components/dashboard/guest-rules-panel'
import { GuestPortalSettingsPanel } from '@/components/dashboard/guest-portal-settings-panel'
import { GuestRequestsPanel } from '@/components/dashboard/guest-requests-panel'
import { GuestFeedbackPanel } from '@/components/dashboard/guest-feedback-panel'
import { ManagerNotificationSummary } from '@/components/dashboard/manager-notification-summary'
import { OpsInboxPanel } from '@/components/dashboard/ops-inbox-panel'
import { LivePageTabShell } from '@/components/dashboard/live-page-tab-shell'
import { loadHotelGuestRequests } from '@/lib/data/guest-portal'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { loadOpsInbox } from '@/lib/data/ops-inbox'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import { getNotificationLog } from '@/lib/data/notification-log'
import { getAuditLog } from '@/lib/data/audit-log'
import { FrontDeskOpsSection } from '@/components/dashboard/front-desk-ops-section'
import { RoleWayfindingPanel } from '@/components/dashboard/role-wayfinding-panel'
import { parseOpsDate } from '@/lib/dates/ops-date'
import { loadFrontDeskOpsContext } from '@/lib/data/load-front-desk-ops'
import { computeBookingsSparkline, computeTodayOperations } from '@/lib/data/overview'
import { getOccupancyToday } from '@/lib/data/occupancy'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRecentNightAudits } from '@/app/actions/night-audit'
import { NightAuditPanel } from '@/components/dashboard/night-audit-panel'
import { getManagerTabBadges } from '@/lib/data/staff-alerts'
import { OpsCalendarPanel } from '@/components/dashboard/ops-calendar-panel'
import { loadOpsCalendarEvents } from '@/lib/data/ops-calendar'
import { todayISO } from '@/lib/stays/helpers'

const MANAGER_HASH_TO_TAB: Record<string, string> = {
  'ops-inbox': 'overview',
  'guest-feedback': 'guest-reviews',
  'guest-reviews': 'guest-reviews',
  'guest-requests': 'guest-portal',
  'night-audit': 'night-audit',
  'audit-log': 'activity',
  'sms-log': 'activity',
}

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ opsDate?: string }>
}) {
  const { opsDate: opsDateParam } = await searchParams
  const frontDesk = await loadFrontDeskOpsContext(opsDateParam)
  const opsDate = frontDesk?.opsDate ?? parseOpsDate(opsDateParam)

  const [complaints, { metrics, reservations, hotelId }, tasks, notificationLog, auditLog, nightAudits] =
    await Promise.all([
      fetchHotelComplaints(),
      getDashboardData(),
      getHousekeepingTasks(),
      getNotificationLog(50),
      getAuditLog(50),
      getRecentNightAudits(),
    ])

  const supabase = await createClient()
  const occupancyToday = hotelId ? await getOccupancyToday(supabase, hotelId) : undefined
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
  const bookingsSparkline = computeBookingsSparkline(reservations)

  let propertyName = 'Property'
  let guestRequests: Awaited<ReturnType<typeof loadHotelGuestRequests>> = []
  let opsInbox: Awaited<ReturnType<typeof loadOpsInbox>> = []
  let smsPrefs: Record<string, boolean> | null = null
  let emailPrefs: Record<string, boolean> | null = null
  let guestFeedback: Awaited<ReturnType<typeof loadHotelGuestFeedback>> | null = null
  let opsCalendarEvents: Awaited<ReturnType<typeof loadOpsCalendarEvents>> = []
  if (hotelId) {
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const admin = createAdminClient()
    const [{ data: hotel }, requests, inbox, feedback, hotelPrefs, calendarEvents] = await Promise.all([
      admin.from('hotels').select('name').eq('id', hotelId).maybeSingle(),
      loadHotelGuestRequests(hotelId),
      loadOpsInbox(hotelId),
      loadHotelGuestFeedback(hotelId),
      admin
        .from('hotels')
        .select('notification_sms_prefs, notification_email_prefs')
        .eq('id', hotelId)
        .maybeSingle(),
      loadOpsCalendarEvents(hotelId, weekStart.toISOString(), weekEnd.toISOString()),
    ])
    propertyName = hotel?.name ?? propertyName
    guestRequests = requests
    opsInbox = inbox
    guestFeedback = feedback
    opsCalendarEvents = calendarEvents
    smsPrefs = (hotelPrefs.data?.notification_sms_prefs as Record<string, boolean>) ?? null
    emailPrefs = (hotelPrefs.data?.notification_email_prefs as Record<string, boolean>) ?? null
  }

  const tabBadges = await getManagerTabBadges()
  const businessDate = todayISO()
  const todayClosed = nightAudits.some((a) => a.business_date === businessDate)

  return (
    <div className="page-shell page-shell--dashboard pb-10">
      <DashboardHero>
        <DashboardToolbar
          title="Manager dashboard"
          eyebrow="Operations"
          occupancy={occupancyToday}
          today={todayOps}
          opsDate={opsDate}
        />
        <DashboardAttention
          today={todayOps}
          metrics={metrics}
          reservationsHref="/manager/reservations"
          billingHref="/manager/reservations"
        />
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
        <RoleWayfindingPanel role="manager" />
        <section className="dashboard-section dashboard-section--compact">
          <FrontDeskOpsSection routePrefix="/manager" opsDateParam={opsDateParam} />
        </section>
      <LivePageTabShell
          hashToTab={MANAGER_HASH_TO_TAB}
          defaultTab="overview"
          tabs={[
            { id: 'overview', label: 'Overview', badge: tabBadges.overview },
            { id: 'guest-portal', label: 'Guest portal', badge: tabBadges.guestPortal },
            { id: 'guest-reviews', label: 'Guest reviews' },
            {
              id: 'night-audit',
              label: 'Night audit',
              badge: todayClosed ? undefined : 1,
            },
            { id: 'activity', label: 'Activity' },
          ]}
          panels={{
            overview: (
              <>
                <section className="dashboard-section space-y-3">
                  <SectionHeading title="Property snapshot" description="Rates, bookings, and balances" />
                  <KPICards metrics={metrics} showRevenue={false} bookingsSparkline={bookingsSparkline} />
                </section>

                <OpsInboxPanel items={opsInbox} />

                <OpsCalendarPanel events={opsCalendarEvents} canManage />

                <div className="dashboard-split-grid">
                  <section className="dashboard-section space-y-4">
                    <SectionHeading title="Complaints" description="Open and in-progress issues" />
                    <ComplaintsOverviewLive initialComplaints={complaints} limit={5} />
                  </section>

                  <section className="dashboard-section space-y-4">
                    <SectionHeading title="Tasks" description="Housekeeping and maintenance" />
                    <TasksList tasks={tasks} />
                  </section>
                </div>
              </>
            ),
            'guest-portal': hotelId ? (
              <>
                <GuestRequestsPanel hotelId={hotelId} initialRequests={guestRequests} />
                <ManagerNotificationSummary smsPrefs={smsPrefs} emailPrefs={emailPrefs} />
                <GuestPortalSettingsPanel
                  hotelId={hotelId}
                  propertyName={propertyName}
                />
                <GuestRulesPanel hotelId={hotelId} propertyName={propertyName} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No property linked to this account.</p>
            ),
            'guest-reviews': guestFeedback ? (
              <section id="guest-reviews" className="dashboard-section scroll-mt-24">
                <SectionHeading title="Guest reviews" description="Feedback from the guest portal" />
                <GuestFeedbackPanel summary={guestFeedback} />
              </section>
            ) : (
              <p className="text-sm text-muted-foreground">No guest feedback yet.</p>
            ),
            'night-audit': (
              <section id="night-audit" className="dashboard-section scroll-mt-24">
                <SectionHeading
                  title="End of day"
                  description="Night audit and business date close"
                />
                <NightAuditPanel audits={nightAudits} todayClosed={todayClosed} />
              </section>
            ),
            activity: (
              <div className="dashboard-split-grid">
                <AuditLogPanel entries={auditLog} />
                <NotificationLogPanel entries={notificationLog} />
              </div>
            ),
        }}
      />
      </div>
    </div>
  )
}

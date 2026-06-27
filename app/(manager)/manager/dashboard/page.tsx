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
import { PageTabShell } from '@/components/dashboard/page-tab-shell'
import { loadHotelGuestRequests } from '@/lib/data/guest-portal'
import { loadHotelGuestFeedback } from '@/lib/data/guest-feedback'
import { loadOpsInbox } from '@/lib/data/ops-inbox'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import { getNotificationLog } from '@/lib/data/notification-log'
import { getAuditLog } from '@/lib/data/audit-log'
import { computeBookingsSparkline, computeTodayOperations } from '@/lib/data/overview'
import { getOccupancyToday } from '@/lib/data/occupancy'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRecentNightAudits } from '@/app/actions/night-audit'
import { NightAuditPanel } from '@/components/dashboard/night-audit-panel'
import { todayISO } from '@/lib/stays/helpers'

const MANAGER_HASH_TO_TAB: Record<string, string> = {
  'ops-inbox': 'overview',
  'guest-feedback': 'guest-portal',
  'guest-requests': 'guest-portal',
  'audit-log': 'activity',
  'sms-log': 'activity',
}

export default async function ManagerDashboardPage() {
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
  const todayOps = computeTodayOperations(reservations)
  const bookingsSparkline = computeBookingsSparkline(reservations)

  let propertyName = 'Property'
  let guestRequests: Awaited<ReturnType<typeof loadHotelGuestRequests>> = []
  let opsInbox: Awaited<ReturnType<typeof loadOpsInbox>> = []
  let smsPrefs: Record<string, boolean> | null = null
  let emailPrefs: Record<string, boolean> | null = null
  let guestFeedback: Awaited<ReturnType<typeof loadHotelGuestFeedback>> | null = null
  if (hotelId) {
    const admin = createAdminClient()
    const [{ data: hotel }, requests, inbox, feedback, hotelPrefs] = await Promise.all([
      admin.from('hotels').select('name').eq('id', hotelId).maybeSingle(),
      loadHotelGuestRequests(hotelId),
      loadOpsInbox(hotelId),
      loadHotelGuestFeedback(hotelId),
      admin
        .from('hotels')
        .select('notification_sms_prefs, notification_email_prefs')
        .eq('id', hotelId)
        .maybeSingle(),
    ])
    propertyName = hotel?.name ?? propertyName
    guestRequests = requests
    opsInbox = inbox
    guestFeedback = feedback
    smsPrefs = (hotelPrefs.data?.notification_sms_prefs as Record<string, boolean>) ?? null
    emailPrefs = (hotelPrefs.data?.notification_email_prefs as Record<string, boolean>) ?? null
  }

  const pendingGuestRequests = guestRequests.filter((r) => r.status === 'pending').length
  const overviewBadge = opsInbox.length
  const guestPortalBadge = pendingGuestRequests
  const businessDate = todayISO()
  const todayClosed = nightAudits.some((a) => a.business_date === businessDate)

  return (
    <div className="page-shell pb-10">
      <DashboardHero>
        <DashboardToolbar
          title="Manager dashboard"
          eyebrow="Operations"
          occupancy={occupancyToday}
          today={todayOps}
        />
        <DashboardAttention
          today={todayOps}
          metrics={metrics}
          reservationsHref="/manager/reservations"
          billingHref="/manager/reservations"
        />
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
      <PageTabShell
          hashToTab={MANAGER_HASH_TO_TAB}
          defaultTab="overview"
          tabs={[
            { id: 'overview', label: 'Overview', badge: overviewBadge },
            { id: 'guest-portal', label: 'Guest portal', badge: guestPortalBadge },
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

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="dashboard-section space-y-4">
                    <SectionHeading title="Complaints" description="Open and in-progress issues" />
                    <ComplaintsOverviewLive initialComplaints={complaints} limit={5} />
                  </section>

                  <section className="dashboard-section space-y-4">
                    <SectionHeading title="Tasks" description="Housekeeping and maintenance" />
                    <TasksList tasks={tasks} />
                  </section>
                </div>

                <section className="dashboard-section space-y-4">
                  <SectionHeading title="End of day" description="Night audit and business date close" />
                  <NightAuditPanel audits={nightAudits} todayClosed={todayClosed} />
                </section>
              </>
            ),
            'guest-portal': hotelId ? (
              <>
                <GuestRequestsPanel hotelId={hotelId} initialRequests={guestRequests} />
                {guestFeedback && <GuestFeedbackPanel summary={guestFeedback} />}
                <ManagerNotificationSummary smsPrefs={smsPrefs} emailPrefs={emailPrefs} />
                <p className="text-sm text-muted-foreground">
                  Guest portal content and house rules are managed by the property owner in Settings.
                </p>
                <GuestPortalSettingsPanel
                  hotelId={hotelId}
                  propertyName={propertyName}
                  canEdit={false}
                />
                <GuestRulesPanel hotelId={hotelId} propertyName={propertyName} canEdit={false} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No property linked to this account.</p>
            ),
            activity: (
              <div className="grid gap-6 xl:grid-cols-2">
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

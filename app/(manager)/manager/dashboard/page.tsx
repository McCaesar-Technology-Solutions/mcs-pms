import { KPICards } from '@/components/dashboard/kpi-cards'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { TasksList } from '@/components/dashboard/tasks-list'
import { NotificationLogPanel } from '@/components/dashboard/notification-log-panel'
import { AuditLogPanel } from '@/components/dashboard/audit-log-panel'
import { GuestRulesPanel } from '@/components/dashboard/guest-rules-panel'
import { GuestPortalSettingsPanel } from '@/components/dashboard/guest-portal-settings-panel'
import { GuestRequestsPanel } from '@/components/dashboard/guest-requests-panel'
import { loadHotelGuestRequests } from '@/lib/data/guest-portal'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'
import { getNotificationLog } from '@/lib/data/notification-log'
import { getAuditLog } from '@/lib/data/audit-log'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function ManagerDashboardPage() {
  const [complaints, { metrics, hotelId }, tasks, notificationLog, auditLog] =
    await Promise.all([
    fetchHotelComplaints(),
    getDashboardData(),
    getHousekeepingTasks(),
    getNotificationLog(20),
    getAuditLog(20),
  ])

  let propertyName = 'Property'
  let guestRequests: Awaited<ReturnType<typeof loadHotelGuestRequests>> = []
  if (hotelId) {
    const admin = createAdminClient()
    const [{ data: hotel }, requests] = await Promise.all([
      admin.from('hotels').select('name').eq('id', hotelId).maybeSingle(),
      loadHotelGuestRequests(hotelId),
    ])
    propertyName = hotel?.name ?? propertyName
    guestRequests = requests
  }

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        badge="Operations"
        title="Manager Dashboard"
        description="Monitor guest complaints, room status, and daily operations."
      />

      <section className="space-y-4">
        <SectionHeading title="Key Metrics" description="Today's operational snapshot" />
        <KPICards metrics={metrics} showRevenue={false} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Complaints" description="Requires your attention" />
        <ComplaintsOverviewLive initialComplaints={complaints} limit={5} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Tasks" description="Housekeeping and maintenance" />
        <TasksList tasks={tasks} />
      </section>

      {hotelId && (
        <>
          <GuestRequestsPanel hotelId={hotelId} initialRequests={guestRequests} />
          <GuestPortalSettingsPanel hotelId={hotelId} propertyName={propertyName} />
          <GuestRulesPanel hotelId={hotelId} propertyName={propertyName} />
        </>
      )}

      <AuditLogPanel entries={auditLog} compact />
      <NotificationLogPanel entries={notificationLog} compact />
    </div>
  )
}

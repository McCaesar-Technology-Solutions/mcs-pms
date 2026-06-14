import { KPICards } from '@/components/dashboard/kpi-cards'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { TasksList } from '@/components/dashboard/tasks-list'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'

export default async function ManagerDashboardPage() {
  const [complaints, { metrics }, tasks] = await Promise.all([
    fetchHotelComplaints(),
    getDashboardData(),
    getHousekeepingTasks(),
  ])

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
    </div>
  )
}

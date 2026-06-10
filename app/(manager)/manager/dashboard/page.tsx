import { KPICards } from '@/components/dashboard/kpi-cards'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { TasksList } from '@/components/dashboard/tasks-list'
import { ComplaintsOverview } from '@/components/complaints/complaints-overview'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function ManagerDashboardPage() {
  const [complaints, { metrics }] = await Promise.all([
    fetchHotelComplaints(),
    getDashboardData(),
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
        <KPICards metrics={metrics} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Complaints" description="Requires your attention" />
        <ComplaintsOverview complaints={complaints} limit={5} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Tasks" description="Housekeeping and maintenance" />
        <TasksList />
      </section>
    </div>
  )
}

import { KPICards } from '@/components/dashboard/kpi-cards'
import { PageHeader } from '@/components/dashboard/page-header'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function ReceptionistDashboardPage() {
  const [complaints, { metrics, availability, reservations }] = await Promise.all([
    fetchHotelComplaints(),
    getDashboardData(),
  ])

  return (
    <div className="page-shell space-y-8">
      <PageHeader
        badge="Front desk"
        title="Reception Dashboard"
        description="Today's arrivals, room availability, and guest issues at a glance."
      />

      <section className="space-y-4">
        <SectionHeading title="Today" description="Occupancy and bookings" />
        <KPICards metrics={metrics} showRevenue={false} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Room Availability" description="Free rooms over the next 14 days" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AvailabilityStrip data={availability} />
          </div>
          <div>
            <BookingsList reservations={reservations} viewAllHref="/receptionist/reservations" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading title="Complaints" description="Recent guest issues" />
        <ComplaintsOverviewLive
          initialComplaints={complaints}
          limit={5}
          complaintsHref="/receptionist/complaints"
        />
      </section>
    </div>
  )
}

import { KPICards } from '@/components/dashboard/kpi-cards'
import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { DarkSection } from '@/components/dashboard/dark-section'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { computeTodayOperations, computeOccupancySparkline } from '@/lib/data/overview'
import { getOccupancyToday } from '@/lib/data/occupancy'
import { createClient } from '@/lib/supabase/server'

export default async function ReceptionistDashboardPage() {
  const [complaints, { metrics, availability, reservations, hotelId }] = await Promise.all([
    fetchHotelComplaints(),
    getDashboardData(),
  ])

  const supabase = await createClient()
  const occupancyToday = hotelId ? await getOccupancyToday(supabase, hotelId) : undefined
  const todayOps = computeTodayOperations(reservations)
  const occupancySparkline = computeOccupancySparkline(availability)

  return (
    <>
      <DarkSection variant="ops" className="dashboard-section">
        <div className="space-y-4">
          <DashboardToolbar
            title="Reception dashboard"
            eyebrow="Front desk"
            occupancy={occupancyToday}
            today={todayOps}
          />
          <DashboardAttention
            today={todayOps}
            metrics={metrics}
            reservationsHref="/receptionist/reservations"
            billingHref="/receptionist/reservations"
          />
        </div>
      </DarkSection>

      <div className="page-shell page-shell--after-hero page-content-stack pb-8">
        <section className="dashboard-section">
          <h2 className="sr-only">Today&apos;s snapshot</h2>
          <KPICards metrics={metrics} showRevenue={false} occupancySparkline={occupancySparkline} />
        </section>

        <section className="dashboard-section space-y-4">
          <SectionHeading title="Room availability" description="Free rooms over the next 14 days" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AvailabilityStrip data={availability} />
            </div>
            <div>
              <BookingsList reservations={reservations} viewAllHref="/receptionist/reservations" />
            </div>
          </div>
        </section>

        <section className="dashboard-section space-y-4">
          <SectionHeading title="Guest issues" description="Recent complaints needing follow-up" />
          <ComplaintsOverviewLive
            initialComplaints={complaints}
            limit={5}
            complaintsHref="/receptionist/complaints"
          />
        </section>
      </div>
    </>
  )
}

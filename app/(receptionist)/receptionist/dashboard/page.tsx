import { KPICards } from '@/components/dashboard/kpi-cards'
import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { BookingsList } from '@/components/dashboard/bookings-list'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import { computeTodayOperations } from '@/lib/data/overview'
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

  return (
    <div className="page-shell page-content-stack pb-10">
      <DashboardHero>
        <div className="space-y-5 p-5 sm:p-6">
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
      </DashboardHero>

      <section className="dashboard-section space-y-3">
        <SectionHeading title="Property snapshot" description="Rates, bookings, and balances" />
        <KPICards metrics={metrics} showRevenue={false} />
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
  )
}

import { DashboardAttention } from '@/components/dashboard/dashboard-attention'
import { DashboardHero } from '@/components/dashboard/dashboard-hero'
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { TodayGuestStrip } from '@/components/dashboard/today-guest-strip'
import { AvailabilityStrip } from '@/components/dashboard/availability-strip'
import { ComplaintsOverviewLive } from '@/components/complaints/complaints-overview-live'
import { fetchHotelComplaints } from '@/lib/data/complaints'
import { getDashboardData } from '@/lib/data/dashboard'
import {
  computeTodayOperations,
  getTodayArrivals,
  getTodayDepartures,
} from '@/lib/data/overview'
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
  const arrivals = getTodayArrivals(reservations)
  const departures = getTodayDepartures(reservations)

  return (
    <div className="page-shell pb-10">
      <DashboardHero>
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
      </DashboardHero>

      <div className="page-content-stack page-shell--after-hero">
        <section className="dashboard-section space-y-4">
          <SectionHeading title="Today on the desk" description="Arrivals and departures" />
          <TodayGuestStrip
            arrivals={arrivals}
            departures={departures}
            reservationsHref="/receptionist/reservations"
          />
        </section>

        <section className="dashboard-section space-y-4">
          <SectionHeading title="Room availability" description="Free rooms over the next 14 days" />
          <AvailabilityStrip data={availability} />
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
    </div>
  )
}

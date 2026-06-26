import { ReservationsManager } from '@/components/dashboard/reservations-manager'
import { ReservationsTimelineSection } from '@/components/dashboard/reservations-timeline-section'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { getProfile } from '@/lib/auth/get-profile'

export default async function ReceptionistReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string; checkIn?: string }>
}) {
  const { q, open, checkIn } = await searchParams
  const [profile, { reservations, roomOptions, occupancySpans, timelineRooms, timelineBars }] =
    await Promise.all([getProfile(), getDashboardData()])

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Bookings"
        title="Reservations"
        description="Create bookings, check guests in and out, and manage stays."
      />

      <div className="flex flex-col gap-6">
        <div className="order-1 md:order-2">
          <ReservationsManager
            reservations={reservations}
            roomOptions={roomOptions}
            occupancySpans={occupancySpans}
            staffRole={profile?.role ?? 'receptionist'}
            initialSearch={q}
            openReservationId={open}
            initialNewFlow={checkIn === '1' ? 'check_in' : undefined}
          />
        </div>
        <div className="order-2 md:order-1">
          <ReservationsTimelineSection rooms={timelineRooms} bars={timelineBars} />
        </div>
      </div>
    </div>
  )
}

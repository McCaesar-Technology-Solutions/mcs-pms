import { ReservationsGantt } from '@/components/dashboard/reservations-gantt'
import { ReservationsManager } from '@/components/dashboard/reservations-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function ReceptionistReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string; checkIn?: string }>
}) {
  const { q, open, checkIn } = await searchParams
  const { reservations, roomOptions, occupancySpans, timelineRooms, timelineBars } =
    await getDashboardData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Bookings"
        title="Reservations"
        description="Create bookings, check guests in and out, and manage stays."
      />

      <ReservationsGantt rooms={timelineRooms} bars={timelineBars} />

      <ReservationsManager
        reservations={reservations}
        roomOptions={roomOptions}
        occupancySpans={occupancySpans}
        initialSearch={q}
        openReservationId={open}
        initialNewFlow={checkIn === '1' ? 'check_in' : undefined}
      />
    </div>
  )
}

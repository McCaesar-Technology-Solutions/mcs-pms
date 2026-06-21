import { ReservationsGantt } from '@/components/dashboard/reservations-gantt'
import { ReservationsManager } from '@/components/dashboard/reservations-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string; checkIn?: string }>
}) {
  const { q, open, checkIn } = await searchParams
  const { reservations, roomOptions, occupancySpans } = await getDashboardData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Bookings"
        title="Reservations"
        description="View and manage all guest reservations across properties."
      />

      <ReservationsGantt data={reservations} />

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

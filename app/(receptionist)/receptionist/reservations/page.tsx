import { ReservationsGantt } from '@/components/dashboard/reservations-gantt'
import { ReservationsManager } from '@/components/dashboard/reservations-manager'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'

export default async function ReceptionistReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>
}) {
  const { q, open } = await searchParams
  const { reservations, roomOptions, occupancySpans } = await getDashboardData()

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Bookings"
        title="Reservations"
        description="Create bookings, check guests in and out, and manage stays."
      />

      <ReservationsGantt data={reservations} />

      <ReservationsManager
        reservations={reservations}
        roomOptions={roomOptions}
        occupancySpans={occupancySpans}
        initialSearch={q}
        openReservationId={open}
      />
    </div>
  )
}

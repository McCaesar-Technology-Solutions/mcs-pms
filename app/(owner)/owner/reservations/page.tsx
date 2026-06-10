import { ReservationsGantt } from '@/components/dashboard/reservations-gantt'
import { ReservationsTable } from '@/components/dashboard/reservations-table'
import { PageHeader } from '@/components/dashboard/page-header'

export default function ReservationsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Bookings"
        title="Reservations"
        description="View and manage all guest reservations across properties."
      />

      <ReservationsGantt />

      <ReservationsTable />
    </div>
  )
}

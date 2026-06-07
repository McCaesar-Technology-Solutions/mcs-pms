import { BookingsManager } from '@/components/dashboard/bookings-manager'
import { PageHeader } from '@/components/dashboard/page-header'

export default function BookingsPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Front Desk"
        title="Bookings Management"
        description="Create, manage, and track all guest bookings across your properties."
      />

      <BookingsManager />
    </div>
  )
}

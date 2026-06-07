import { HousekeepingKanban } from '@/components/dashboard/housekeeping-kanban'
import { RoomStatusGrid } from '@/components/dashboard/room-status-grid'
import { StaffAvailability } from '@/components/dashboard/staff-availability'
import { PageHeader } from '@/components/dashboard/page-header'

export default function HousekeepingPage() {
  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Operations"
        title="Housekeeping Board"
        description="Manage cleaning tasks, room status, and staff assignments."
      />

      <HousekeepingKanban />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RoomStatusGrid />
        </div>
        <StaffAvailability />
      </div>
    </div>
  )
}

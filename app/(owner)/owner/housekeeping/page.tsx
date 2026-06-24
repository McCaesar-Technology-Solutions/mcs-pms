import { HousekeepingKanban } from '@/components/dashboard/housekeeping-kanban'
import { RoomStatusGrid } from '@/components/dashboard/room-status-grid'
import { StaffAvailability } from '@/components/dashboard/staff-availability'
import { PageHeader } from '@/components/dashboard/page-header'
import { getDashboardData } from '@/lib/data/dashboard'
import { getStaffData } from '@/lib/data/staff'
import { getHousekeepingTasks } from '@/lib/data/housekeeping'

export default async function OwnerHousekeepingPage() {
  const [{ rooms, roomOptions }, { staff }, tasks] = await Promise.all([
    getDashboardData(),
    getStaffData(),
    getHousekeepingTasks(),
  ])

  const assignableStaff = staff
    .filter((s) => s.is_active !== false)
    .map((s) => ({ id: s.id, name: s.name }))

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        badge="Operations"
        title="Housekeeping board"
        description="Create, assign, and track cleaning and maintenance tasks."
      />

      <HousekeepingKanban tasks={tasks} rooms={roomOptions} staff={assignableStaff} canManage />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RoomStatusGrid rooms={rooms} title="Room status" />
        </div>
        <StaffAvailability staff={staff} />
      </div>
    </div>
  )
}

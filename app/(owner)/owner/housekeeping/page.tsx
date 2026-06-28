import { HousekeepingBoard } from '@/components/dashboard/housekeeping-board'
import { RoomStatusGrid } from '@/components/dashboard/room-status-grid'
import { StaffAvailability } from '@/components/dashboard/staff-availability'
import { PageHeader } from '@/components/dashboard/page-header'
import { getProfile } from '@/lib/auth/get-profile'
import { getDashboardData } from '@/lib/data/dashboard'
import { getStaffData } from '@/lib/data/staff'
import { getHousekeepingTasks, groupOpenTasksByRoom } from '@/lib/data/housekeeping'

export default async function OwnerHousekeepingPage() {
  const [profile, { rooms, roomOptions }, { staff }, tasks] = await Promise.all([
    getProfile(),
    getDashboardData(),
    getStaffData(),
    getHousekeepingTasks(),
  ])

  const assignableStaff = staff
    .filter((s) => s.is_active !== false)
    .map((s) => ({ id: s.id, name: s.name }))

  const openTasksByRoom = groupOpenTasksByRoom(tasks)

  return (
    <div className="page-shell page-content-stack">
      <PageHeader
        badge="Operations"
        title="Housekeeping board"
        description="Assign tasks, track cleans, and approve rooms after inspection."
      />

      <HousekeepingBoard
        tasks={tasks}
        rooms={roomOptions}
        staff={assignableStaff}
        canManage
        currentUserId={profile?.id}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RoomStatusGrid
            rooms={rooms}
            title="Room status"
            openTasksByRoom={openTasksByRoom}
            housekeepingHref="/owner/housekeeping"
          />
        </div>
        <StaffAvailability staff={staff} />
      </div>
    </div>
  )
}

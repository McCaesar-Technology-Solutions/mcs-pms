import { TechnicianTasks } from '@/components/technician/technician-tasks'
import { TechnicianHousekeeping } from '@/components/technician/technician-housekeeping'
import {
  getAssignedHousekeepingTasks,
  getUnassignedHousekeepingTasks,
} from '@/lib/data/housekeeping'

export default async function TechnicianTasksPage() {
  const [assignedTasks, unassignedTasks] = await Promise.all([
    getAssignedHousekeepingTasks(),
    getUnassignedHousekeepingTasks(),
  ])

  return (
    <>
      <TechnicianTasks />
      <div className="mx-auto w-full max-w-lg px-4">
        <TechnicianHousekeeping
          assignedTasks={assignedTasks}
          unassignedTasks={unassignedTasks}
        />
      </div>
    </>
  )
}

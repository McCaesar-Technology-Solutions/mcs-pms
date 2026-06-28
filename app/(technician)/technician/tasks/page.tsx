import { TechnicianWorkspace } from '@/components/technician/technician-workspace'
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
    <TechnicianWorkspace
      assignedTasks={assignedTasks}
      unassignedTasks={unassignedTasks}
    />
  )
}

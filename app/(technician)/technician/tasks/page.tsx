import { Suspense } from 'react'
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
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading tasks…</p>}>
      <TechnicianWorkspace
        assignedTasks={assignedTasks}
        unassignedTasks={unassignedTasks}
      />
    </Suspense>
  )
}

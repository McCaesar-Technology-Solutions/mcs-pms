import { TechnicianTasks } from '@/components/technician/technician-tasks'
import { TechnicianHousekeeping } from '@/components/technician/technician-housekeeping'
import { getAssignedHousekeepingTasks } from '@/lib/data/housekeeping'

export default async function TechnicianTasksPage() {
  const housekeepingTasks = await getAssignedHousekeepingTasks()

  return (
    <>
      <TechnicianTasks />
      <div className="mx-auto w-full max-w-lg px-4">
        <TechnicianHousekeeping tasks={housekeepingTasks} />
      </div>
    </>
  )
}

'use client'

import { TechnicianTaskCards } from '@/components/technician/technician-task-cards'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'

interface TechnicianHousekeepingProps {
  assignedTasks: HousekeepingTaskView[]
  unassignedTasks?: HousekeepingTaskView[]
}

export function TechnicianHousekeeping({
  assignedTasks,
  unassignedTasks = [],
}: TechnicianHousekeepingProps) {
  const hasWork =
    assignedTasks.some((t) => t.status !== 'done') || (unassignedTasks?.length ?? 0) > 0

  if (!hasWork) return null

  const openCount =
    assignedTasks.filter((t) => t.status !== 'done').length + (unassignedTasks?.length ?? 0)

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Housekeeping tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start assigned jobs or claim open tasks from the board.
          </p>
        </div>
        <span className="rounded-full bg-[#3C216C]/10 px-3 py-1 text-xs font-bold text-[#3C216C]">
          {openCount} open
        </span>
      </div>
      <TechnicianTaskCards assignedTasks={assignedTasks} unassignedTasks={unassignedTasks} />
    </section>
  )
}

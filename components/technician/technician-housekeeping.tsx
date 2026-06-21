'use client'

import { HousekeepingKanban } from '@/components/dashboard/housekeeping-kanban'
import type { HousekeepingTaskView } from '@/lib/data/housekeeping'

interface TechnicianHousekeepingProps {
  tasks: HousekeepingTaskView[]
}

export function TechnicianHousekeeping({ tasks }: TechnicianHousekeepingProps) {
  const openTasks = tasks.filter((t) => t.status !== 'done')

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Housekeeping tasks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs assigned to you from the housekeeping board.
        </p>
      </div>
      <HousekeepingKanban tasks={openTasks} rooms={[]} staff={[]} statusOnly />
    </section>
  )
}

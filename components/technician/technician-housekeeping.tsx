'use client'

import { HousekeepingKanban } from '@/components/dashboard/housekeeping-kanban'
import type { HousekeepingTaskView } from '@/lib/data/housekeeping'

interface TechnicianHousekeepingProps {
  tasks: HousekeepingTaskView[]
}

export function TechnicianHousekeeping({ tasks }: TechnicianHousekeepingProps) {
  const openTasks = tasks.filter((t) => t.status !== 'done')

  if (openTasks.length === 0) return null

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Housekeeping tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jobs assigned to you from the housekeeping board.
          </p>
        </div>
        <span className="rounded-full bg-[#3C216C]/10 px-3 py-1 text-xs font-bold text-[#3C216C]">
          {openTasks.length} open
        </span>
      </div>
      <HousekeepingKanban tasks={openTasks} rooms={[]} staff={[]} statusOnly />
    </section>
  )
}

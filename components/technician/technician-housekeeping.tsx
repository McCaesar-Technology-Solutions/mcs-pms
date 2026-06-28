'use client'

import { TechnicianTaskCards } from '@/components/technician/technician-task-cards'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import { Sparkles } from 'lucide-react'

interface TechnicianHousekeepingProps {
  assignedTasks: HousekeepingTaskView[]
  unassignedTasks?: HousekeepingTaskView[]
}

export function TechnicianHousekeeping({
  assignedTasks,
  unassignedTasks = [],
}: TechnicianHousekeepingProps) {
  const openCount =
    assignedTasks.filter((t) => t.status !== 'done').length + (unassignedTasks?.length ?? 0)

  const hasWork =
    assignedTasks.some((t) => t.status !== 'done') ||
    (unassignedTasks?.length ?? 0) > 0 ||
    assignedTasks.some((t) => t.status === 'done')

  if (!hasWork) {
    return (
      <div className="technician-empty">
        <div className="technician-empty__icon">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-[var(--tech-fg)]">No housekeeping tasks</p>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-[var(--tech-fg-muted)]">
          Open jobs from the board will appear here. You can claim unassigned tasks when they are
          available.
        </p>
      </div>
    )
  }

  return (
    <section className="technician-section">
      <div className="technician-section__intro">
        <p className="technician-section__title">Housekeeping</p>
        <p className="technician-section__hint">
          Start assigned jobs or claim open tasks from the board.
        </p>
        {openCount > 0 && (
          <span className="technician-section__count">{openCount} open</span>
        )}
      </div>
      <TechnicianTaskCards assignedTasks={assignedTasks} unassignedTasks={unassignedTasks} />
    </section>
  )
}

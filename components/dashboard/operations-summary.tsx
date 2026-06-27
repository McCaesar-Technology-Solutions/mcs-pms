import Link from 'next/link'
import { AlertCircle, Briefcase, ChevronRight, Clock } from 'lucide-react'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import {
  countNeedsInspectionTasks,
  countOverdueTasks,
} from '@/lib/housekeeping/task-view'

interface OperationsSummaryProps {
  tasks: HousekeepingTaskView[]
  housekeepingHref?: string
}

export function OperationsSummary({
  tasks,
  housekeepingHref = '/owner/housekeeping',
}: OperationsSummaryProps) {
  const open = tasks.filter((t) => t.status !== 'done').length
  const overdue = countOverdueTasks(tasks.filter((t) => t.status !== 'done'))
  const inspect = countNeedsInspectionTasks(tasks)

  return (
    <div className="ops-summary">
      <div className="ops-summary__header">
        <div>
          <h2 className="section-heading__title">Operations</h2>
          <p className="ops-summary__meta">
            {open === 0 ? 'No open tasks' : `${open} open task${open === 1 ? '' : 's'}`}
          </p>
        </div>
        <Link href={housekeepingHref} className="ops-summary__link">
          Housekeeping
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="ops-summary__grid">
        <div className="ops-summary__stat">
          <Briefcase className="h-4 w-4 text-primary/70" strokeWidth={2} />
          <div>
            <p className="ops-summary__value">{open}</p>
            <p className="ops-summary__label">Open</p>
          </div>
        </div>
        <div className={`ops-summary__stat ${overdue > 0 ? 'ops-summary__stat--warn' : ''}`}>
          <AlertCircle className="h-4 w-4" strokeWidth={2} />
          <div>
            <p className="ops-summary__value">{overdue}</p>
            <p className="ops-summary__label">Overdue</p>
          </div>
        </div>
        <div className={`ops-summary__stat ${inspect > 0 ? 'ops-summary__stat--info' : ''}`}>
          <Clock className="h-4 w-4" strokeWidth={2} />
          <div>
            <p className="ops-summary__value">{inspect}</p>
            <p className="ops-summary__label">Inspection</p>
          </div>
        </div>
      </div>
    </div>
  )
}

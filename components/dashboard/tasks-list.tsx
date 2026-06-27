'use client'

import Link from 'next/link'
import { CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import { countNeedsInspectionTasks, countOverdueTasks } from '@/lib/housekeeping/task-view'
import type { TaskStatus } from '@/types'

type ColumnId = TaskStatus

const columnMeta: Record<ColumnId, { label: string; tint: string }> = {
  todo: { label: 'To Do', tint: 'bg-[var(--comp-coral-soft)]' },
  in_progress: { label: 'In Progress', tint: 'bg-[var(--comp-sand-soft)]' },
  done: { label: 'Done', tint: 'bg-[var(--comp-teal-soft)]' },
}

function getTaskIcon(status: ColumnId) {
  switch (status) {
    case 'done':
      return <CheckCircle className="h-4 w-4 text-[var(--comp-teal)]" />
    case 'in_progress':
      return <Clock className="h-4 w-4 text-[var(--comp-sand)]" />
    case 'todo':
      return <AlertCircle className="h-4 w-4 text-red-600" />
    default:
      return null
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'kanban-priority-pill kanban-priority-pill--high'
    case 'medium':
      return 'kanban-priority-pill kanban-priority-pill--medium'
    case 'low':
      return 'kanban-priority-pill kanban-priority-pill--low'
    default:
      return 'kanban-priority-pill bg-gray-100 text-gray-700'
  }
}

export function TasksList({
  tasks,
  housekeepingHref = '/manager/housekeeping',
}: {
  tasks: HousekeepingTaskView[]
  housekeepingHref?: string
}) {
  const byStatus: Record<ColumnId, HousekeepingTaskView[]> = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  }

  const isEmpty = tasks.length === 0
  const overdueCount = countOverdueTasks(tasks.filter((t) => t.status !== 'done'))
  const inspectCount = countNeedsInspectionTasks(tasks)

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Task summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Housekeeping and maintenance across your rooms
            </p>
          </div>
          {!isEmpty && (
            <Link
              href={housekeepingHref}
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Open board
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
        {(overdueCount > 0 || inspectCount > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {overdueCount > 0 && (
              <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-700">
                {overdueCount} overdue
              </span>
            )}
            {inspectCount > 0 && (
              <span className="rounded-full bg-[var(--comp-sky-soft)] px-3 py-1 text-xs font-semibold text-[var(--comp-sky-ink)]">
                {inspectCount} need inspection
              </span>
            )}
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="p-6">
          <DataEmptyState message="No housekeeping tasks yet." className="border-0 shadow-none" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-6">
          {(['todo', 'in_progress', 'done'] as ColumnId[]).map((status) => (
            <div key={status} className={`overflow-hidden rounded-xl p-4 ${columnMeta[status].tint}`}>
              <h4 className="text-sm font-semibold text-foreground">{columnMeta[status].label}</h4>
              <p className="mt-1 text-3xl font-bold text-primary">{byStatus[status].length}</p>

              <div className="card-list-tray mt-3 space-y-2.5">
                {byStatus[status].slice(0, 3).map((task) => (
                  <Link
                    key={task.id}
                    href={housekeepingHref}
                    className="elevated-list-item flex items-start gap-2.5 p-3 transition-colors hover:bg-white/80"
                  >
                    <div className="mt-0.5 shrink-0">{getTaskIcon(status)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#111827]">
                        {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted-foreground">{task.taskType}</p>
                      <span className={`mt-2 inline-flex ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import { countNeedsInspectionTasks, countOverdueTasks } from '@/lib/housekeeping/task-view'
import type { TaskPriority, TaskStatus } from '@/types'

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

const statusColors: Record<TaskStatus, string> = {
  todo: 'task-summary-pipeline__segment--todo',
  in_progress: 'task-summary-pipeline__segment--progress',
  done: 'task-summary-pipeline__segment--done',
}

function priorityLabel(priority: TaskPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

function priorityClass(priority: TaskPriority) {
  switch (priority) {
    case 'high':
      return 'bg-red-500/12 text-red-700'
    case 'medium':
      return 'bg-[var(--comp-sand-soft)] text-[var(--comp-sand-ink)]'
    default:
      return 'bg-[var(--comp-slate-soft)] text-[var(--comp-slate-ink)]'
  }
}

function sortOpenTasks(tasks: HousekeepingTaskView[]) {
  const rank = { high: 0, medium: 1, low: 2 }
  return [...tasks]
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      if (a.status === 'todo' && b.status !== 'todo') return -1
      if (b.status === 'todo' && a.status !== 'todo') return 1
      return rank[a.priority] - rank[b.priority]
    })
}

export function TasksList({
  tasks,
  housekeepingHref = '/manager/housekeeping',
}: {
  tasks: HousekeepingTaskView[]
  housekeepingHref?: string
}) {
  const isEmpty = tasks.length === 0
  const overdueCount = countOverdueTasks(tasks.filter((t) => t.status !== 'done'))
  const inspectCount = countNeedsInspectionTasks(tasks)

  const counts = useMemo(
    () => ({
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks],
  )

  const total = Math.max(tasks.length, 1)
  const queue = useMemo(() => sortOpenTasks(tasks).slice(0, 5), [tasks])

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Task summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Open work across housekeeping and maintenance
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
              <span className="rounded-full bg-red-500/12 px-3 py-1 text-xs font-semibold text-red-700">
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
        <>
          <div className="task-summary-pipeline">
            <div className="task-summary-pipeline__bar" aria-hidden>
              {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) =>
                counts[status] > 0 ? (
                  <div
                    key={status}
                    className={`task-summary-pipeline__segment ${statusColors[status]}`}
                    style={{ flexGrow: counts[status] / total }}
                  />
                ) : null,
              )}
            </div>
            <div className="task-summary-pipeline__legend">
              {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
                <span key={status} className="task-summary-pipeline__legend-item">
                  <span className={`task-summary-pipeline__dot ${statusColors[status]}`} />
                  {statusLabels[status]} <strong>{counts[status]}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="task-summary-queue">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {queue.length > 0 ? 'Up next' : 'All caught up'}
            </p>
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks in the queue.</p>
            ) : (
              queue.map((task) => (
                <Link key={task.id} href={housekeepingHref} className="task-summary-row">
                  <span className="shrink-0 text-muted-foreground">
                    {task.status === 'in_progress' ? (
                      <Clock className="h-4 w-4 text-[var(--comp-sand)]" />
                    ) : task.isOverdue ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-[var(--comp-coral)]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {task.roomNumber ? `Room ${task.roomNumber}` : 'General task'}
                    </span>
                    <span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">
                      {task.taskType.replace(/_/g, ' ')}
                      {task.isOverdue ? ' · overdue' : ''}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityClass(task.priority)}`}
                  >
                    {priorityLabel(task.priority)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

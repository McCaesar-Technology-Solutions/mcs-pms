'use client'

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle,
  Play,
  Sparkles,
  Search,
  Wrench,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  claimHousekeepingTask,
  setHousekeepingTaskStatus,
} from '@/app/actions/housekeeping'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import type { HousekeepingTaskType, TaskStatus } from '@/types'

const TASK_TYPE_CONFIG: Record<HousekeepingTaskType, { label: string; icon: LucideIcon }> = {
  clean: { label: 'Clean', icon: Sparkles },
  inspect: { label: 'Inspect', icon: Search },
  maintenance: { label: 'Maintenance', icon: Wrench },
  restock: { label: 'Restock', icon: Package },
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

function formatDueDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function runAction(
  startTransition: ReturnType<typeof useTransition>[1],
  router: ReturnType<typeof useRouter>,
  action: () => Promise<{ success: boolean; error?: string }>,
  successMessage = 'Task updated',
) {
  startTransition(async () => {
    const result = await action()
    if (result.success) {
      toast.success(successMessage)
      router.refresh()
    } else {
      toast.error(result.error ?? 'Update failed')
    }
  })
}

function TaskCard({
  task,
  isPending,
  onStart,
  onComplete,
}: {
  task: HousekeepingTaskView
  isPending: boolean
  onStart: () => void
  onComplete: () => void
}) {
  const typeConfig = TASK_TYPE_CONFIG[task.taskType]
  const TaskIcon = typeConfig.icon

  return (
    <article
      className={`technician-job-card ${task.isOverdue ? 'technician-job-card--alert' : ''}`}
    >
      <div className="technician-job-card__summary">
        <div className="technician-job-card__icon">
          <TaskIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--tech-fg)]">
            {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
          </p>
          <p className="mt-1 text-sm text-[var(--tech-fg-muted)]">{typeConfig.label}</p>
          {task.notes && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--tech-fg-muted)]">{task.notes}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`technician-pill ${statusPillForHousekeeping(task.status)}`}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className={`technician-pill ${priorityPillClass(task.priority)}`}>
              {task.priority}
            </span>
            {task.dueDate && (
              <span className="text-xs text-[var(--tech-fg-muted)]">
                Due {formatDueDate(task.dueDate)}
                {task.isOverdue && <span className="font-semibold text-red-600"> · Overdue</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      {task.status !== 'done' && (
        <div className="technician-job-card__actions">
          {task.status === 'todo' && (
            <button
              type="button"
              onClick={onStart}
              disabled={isPending}
              className="technician-btn technician-btn--primary flex-1"
            >
              <Play className="h-4 w-4" />
              Start job
            </button>
          )}
          {task.status === 'in_progress' && (
            <button
              type="button"
              onClick={onComplete}
              disabled={isPending}
              className="technician-btn technician-btn--accent flex-1"
            >
              <CheckCircle className="h-4 w-4" />
              Mark complete
            </button>
          )}
        </div>
      )}
    </article>
  )
}

function statusPillForHousekeeping(status: TaskStatus) {
  switch (status) {
    case 'todo':
      return 'technician-pill--status-waiting'
    case 'in_progress':
      return 'technician-pill--status-active'
    default:
      return 'technician-pill--status-done'
  }
}

function priorityPillClass(priority: string) {
  switch (priority) {
    case 'urgent':
      return 'technician-pill--priority-urgent'
    case 'high':
      return 'technician-pill--priority-high'
    case 'low':
      return 'technician-pill--priority-low'
    default:
      return 'technician-pill--priority-medium'
  }
}

function ClaimCard({
  task,
  isPending,
  onClaim,
}: {
  task: HousekeepingTaskView
  isPending: boolean
  onClaim: () => void
}) {
  const typeConfig = TASK_TYPE_CONFIG[task.taskType]
  const TaskIcon = typeConfig.icon

  return (
    <article className="technician-job-card technician-job-card--claim">
      <div className="technician-job-card__summary">
        <div className="technician-job-card__icon">
          <TaskIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--tech-fg)]">
            {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
          </p>
          <p className="mt-1 text-sm text-[var(--tech-fg-muted)]">{typeConfig.label}</p>
          {task.notes && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--tech-fg-muted)]">{task.notes}</p>
          )}
          <span className={`technician-pill mt-3 ${priorityPillClass(task.priority)}`}>
            {task.priority}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onClaim}
        disabled={isPending}
        className="technician-btn technician-btn--ghost w-full"
      >
        Claim & start
      </button>
    </article>
  )
}

interface TechnicianTaskCardsProps {
  assignedTasks: HousekeepingTaskView[]
  unassignedTasks?: HousekeepingTaskView[]
}

export function TechnicianTaskCards({
  assignedTasks,
  unassignedTasks = [],
}: TechnicianTaskCardsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const refreshFromRealtime = useCallback(() => {
    router.refresh()
  }, [router])

  useRealtimeRefresh('housekeeping', refreshFromRealtime)

  const openAssigned = assignedTasks.filter((t) => t.status !== 'done')
  const doneToday = assignedTasks.filter((t) => t.status === 'done').slice(0, 5)

  if (openAssigned.length === 0 && unassignedTasks.length === 0) {
    return <DataEmptyState message="No housekeeping tasks right now." />
  }

  const run = (action: () => Promise<{ success: boolean; error?: string }>, msg?: string) =>
    runAction(startTransition, router, action, msg)

  return (
    <div className="technician-job-list">
      {openAssigned.length > 0 && (
        <section className="space-y-3">
          <h3 className="technician-list-label">My jobs ({openAssigned.length})</h3>
          <div className="space-y-3">
            {openAssigned.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isPending={isPending}
                onStart={() =>
                  run(() => setHousekeepingTaskStatus(task.id, 'in_progress'), 'Job started')
                }
                onComplete={() =>
                  run(
                    () => setHousekeepingTaskStatus(task.id, 'done'),
                    task.taskType === 'clean'
                      ? 'Clean complete — sent for inspection'
                      : 'Task complete',
                  )
                }
              />
            ))}
          </div>
        </section>
      )}

      {unassignedTasks.length > 0 && (
        <section className="space-y-3">
          <h3 className="technician-list-label">Available to claim ({unassignedTasks.length})</h3>
          <div className="space-y-3">
            {unassignedTasks.map((task) => (
              <ClaimCard
                key={task.id}
                task={task}
                isPending={isPending}
                onClaim={() =>
                  run(() => claimHousekeepingTask(task.id), 'Task claimed — good luck!')
                }
              />
            ))}
          </div>
        </section>
      )}

      {doneToday.length > 0 && (
        <section className="space-y-3">
          <h3 className="technician-list-label">Recently completed</h3>
          <div className="space-y-2">
            {doneToday.map((task) => (
              <div key={task.id} className="technician-done-row">
                <span className="font-medium text-[var(--tech-fg)]">
                  Room {task.roomNumber ?? '?'} · {TASK_TYPE_CONFIG[task.taskType].label}
                </span>
                <CheckCircle className="h-4 w-4 text-[var(--brand-purple)]" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

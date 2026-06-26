'use client'

import { useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clock,
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
import { Button } from '@/components/ui/button'
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
      className={`elevated-list-item p-5 ${task.isOverdue ? 'ring-2 ring-red-200' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-foreground">
            {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#faf8fc] px-2.5 py-1">
            <TaskIcon className="h-4 w-4 text-[#4c1d95]" />
            <span className="text-sm font-medium text-[#374151]">{typeConfig.label}</span>
          </div>
        </div>
        <span className={`kanban-priority-pill kanban-priority-pill--${task.priority}`}>
          {task.priority}
        </span>
      </div>

      {task.notes && (
        <p className="mt-3 text-sm text-muted-foreground">{task.notes}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-semibold text-foreground">
          {task.status === 'todo' && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
          {task.status === 'in_progress' && <Clock className="h-3.5 w-3.5 text-amber-500" />}
          {task.status === 'done' && <CheckCircle className="h-3.5 w-3.5 text-[#3C216C]" />}
          {STATUS_LABEL[task.status]}
        </span>
        {task.dueDate && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            Due {formatDueDate(task.dueDate)}
            {task.isOverdue && <span className="font-bold text-red-600">· Overdue</span>}
          </span>
        )}
      </div>

      {task.status !== 'done' && (
        <div className="mt-4 flex gap-2">
          {task.status === 'todo' && (
            <Button
              type="button"
              onClick={onStart}
              disabled={isPending}
              className="flex-1 bg-[#3C216C] text-white hover:bg-[#4c2a85]"
            >
              <Play className="mr-2 h-4 w-4" />
              Start job
            </Button>
          )}
          {task.status === 'in_progress' && (
            <Button
              type="button"
              onClick={onComplete}
              disabled={isPending}
              className="flex-1 bg-[#D4A62E] text-white hover:bg-[#c49a28]"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark complete
            </Button>
          )}
        </div>
      )}
    </article>
  )
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
    <article className="elevated-list-item border-dashed p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-foreground">
            {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#faf8fc] px-2.5 py-1">
            <TaskIcon className="h-4 w-4 text-[#4c1d95]" />
            <span className="text-sm font-medium">{typeConfig.label}</span>
          </div>
        </div>
        <span className={`kanban-priority-pill kanban-priority-pill--${task.priority}`}>
          {task.priority}
        </span>
      </div>
      {task.notes && <p className="mt-3 text-sm text-muted-foreground">{task.notes}</p>}
      <Button
        type="button"
        onClick={onClaim}
        disabled={isPending}
        variant="outline"
        className="mt-4 w-full border-[#3C216C] text-[#3C216C] hover:bg-[#3C216C]/5"
      >
        Claim & start
      </Button>
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
    <div className="space-y-8">
      {openAssigned.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            My jobs ({openAssigned.length})
          </h3>
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Available to claim ({unassignedTasks.length})
          </h3>
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
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recently completed
          </h3>
          <div className="space-y-2">
            {doneToday.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  Room {task.roomNumber ?? '?'} · {TASK_TYPE_CONFIG[task.taskType].label}
                </span>
                <CheckCircle className="h-4 w-4 text-[#3C216C]" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

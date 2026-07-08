'use client'

import { useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { assignHousekeepingTask, setHousekeepingTaskStatus } from '@/app/actions/housekeeping'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import type { TaskStatus } from '@/types'

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

interface HousekeepingTableViewProps {
  tasks: HousekeepingTaskView[]
  rooms: { id: string; number: string }[]
  staff: { id: string; name: string }[]
  canManage?: boolean
  currentUserId?: string
  highlightTaskId?: string
}

function formatDueDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function HousekeepingTableView({
  tasks,
  rooms,
  staff,
  canManage,
  currentUserId,
  highlightTaskId,
}: HousekeepingTableViewProps) {
  const [pending, startTransition] = useTransition()

  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r.number])), [rooms])
  const staffMap = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const statusOrder = { todo: 0, in_progress: 1, done: 2 }
        const sd = statusOrder[a.status] - statusOrder[b.status]
        if (sd !== 0) return sd
        return (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
      }),
    [tasks],
  )

  function onStatusChange(taskId: string, status: TaskStatus) {
    startTransition(async () => {
      const result = await setHousekeepingTaskStatus(taskId, status)
      if (result.success) toast.success('Task updated')
      else toast.error(result.error ?? 'Update failed')
    })
  }

  function onAssign(taskId: string, assigneeId: string) {
    startTransition(async () => {
      const result = await assignHousekeepingTask(taskId, assigneeId)
      if (result.success) toast.success('Task assigned')
      else toast.error(result.error ?? 'Assign failed')
    })
  }

  if (tasks.length === 0) {
    return <DataEmptyState message="No housekeeping tasks assigned yet." />
  }

  function renderAssignee(task: HousekeepingTaskView) {
    if (canManage) {
      return (
        <select
          value={task.assignedTo ?? ''}
          disabled={pending}
          onChange={(e) => onAssign(task.id, e.target.value)}
          className="app-field app-field--compact w-full max-w-[180px]"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )
    }
    return (
      <span className="text-muted-foreground">
        {task.assignedTo ? staffMap.get(task.assignedTo) : 'Unassigned'}
      </span>
    )
  }

  function renderStatus(task: HousekeepingTaskView) {
    if (canManage || task.assignedTo === currentUserId) {
      return (
        <select
          value={task.status}
          disabled={pending}
          onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          className="app-field app-field--compact w-full max-w-[140px] capitalize"
        >
          {(['todo', 'in_progress', 'done'] as TaskStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )
    }
    return <span className="capitalize text-muted-foreground">{STATUS_LABEL[task.status]}</span>
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="space-y-3 p-4 md:hidden">
        {sorted.map((task) => (
          <div
            key={task.id}
            id={`hk-task-${task.id}`}
            className={`elevated-list-item p-4 ${highlightTaskId === task.id ? 'hk-task--highlight' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex flex-wrap items-center gap-2 font-semibold text-foreground">
                  Room {task.roomId ? (roomMap.get(task.roomId) ?? task.roomId.slice(0, 6)) : '-'}
                  {task.roomDoNotDisturb && <GuestDndBadge compact />}
                </p>
                <p className="mt-0.5 capitalize text-sm text-muted-foreground">{task.taskType}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Due {task.dueDate ? formatDueDate(task.dueDate) : '—'}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Assignee</p>
                {renderAssignee(task)}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
                {renderStatus(task)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden data-table-wrap overflow-x-auto px-4 pb-4 pt-2 md:block">
        <table className="data-table w-full min-w-[720px]">
          <thead>
            <tr>
              <th>Room</th>
              <th>Task</th>
              <th>Due</th>
              <th>Assignee</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr
                key={task.id}
                id={`hk-task-${task.id}`}
                className={highlightTaskId === task.id ? 'hk-task--highlight' : undefined}
              >
                <td className="font-medium text-foreground">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {task.roomId ? (roomMap.get(task.roomId) ?? task.roomId.slice(0, 6)) : '-'}
                    {task.roomDoNotDisturb && <GuestDndBadge compact />}
                  </span>
                </td>
                <td className="capitalize text-muted-foreground">{task.taskType}</td>
                <td className="text-muted-foreground">
                  {task.dueDate ? formatDueDate(task.dueDate) : '-'}
                </td>
                <td>{renderAssignee(task)}</td>
                <td>{renderStatus(task)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

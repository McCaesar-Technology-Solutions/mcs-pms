'use client'

import { useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { assignHousekeepingTask, setHousekeepingTaskStatus } from '@/app/actions/housekeeping'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
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

  return (
    <div className="surface-card overflow-hidden">
      <div className="data-table-wrap overflow-x-auto px-4 pb-4 pt-2">
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
              <tr key={task.id}>
                <td className="font-medium text-foreground">
                  {task.roomId ? (roomMap.get(task.roomId) ?? task.roomId.slice(0, 6)) : '-'}
                </td>
                <td className="capitalize text-muted-foreground">{task.taskType}</td>
                <td className="text-muted-foreground">
                  {task.dueDate ? formatDueDate(task.dueDate) : '-'}
                </td>
                <td>
                  {canManage ? (
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
                  ) : (
                    <span className="text-muted-foreground">
                      {task.assignedTo ? staffMap.get(task.assignedTo) : 'Unassigned'}
                    </span>
                  )}
                </td>
                <td>
                  {canManage || task.assignedTo === currentUserId ? (
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
                  ) : (
                    <span className="capitalize text-muted-foreground">{STATUS_LABEL[task.status]}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

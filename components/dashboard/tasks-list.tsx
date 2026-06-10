'use client'

import { housekeepingTasks } from '@/lib/mock-data'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'
import type { HousekeepingTaskView } from '@/lib/data/housekeeping'
import type { TaskStatus } from '@/types'

type ColumnId = TaskStatus

const columnMeta: Record<ColumnId, { label: string; tint: string }> = {
  todo: { label: 'To Do', tint: 'bg-red-500/8' },
  in_progress: { label: 'In Progress', tint: 'bg-amber-500/8' },
  done: { label: 'Done', tint: 'bg-[#3C216C]/8' },
}

function getTaskIcon(status: ColumnId) {
  switch (status) {
    case 'done':
      return <CheckCircle className="h-4 w-4 text-amber-600" />
    case 'in_progress':
      return <Clock className="h-4 w-4 text-amber-600" />
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

export function TasksList({ tasks }: { tasks?: HousekeepingTaskView[] }) {
  if (tasks) return <DbTasksList tasks={tasks} />
  return <MockTasksList />
}

function Shell({
  counts,
  renderColumn,
}: {
  counts: Record<ColumnId, number>
  renderColumn: (status: ColumnId) => React.ReactNode
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-[#111827]">Task Summary</h3>
        <p className="mt-1 text-sm text-muted-foreground">Housekeeping and maintenance across your rooms</p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-6">
        {(['todo', 'in_progress', 'done'] as ColumnId[]).map((status) => (
          <div key={status} className={`overflow-hidden rounded-xl ${columnMeta[status].tint}`}>
            <div className="border-b border-[#E9ECEF] px-4 py-3">
              <h4 className="text-sm font-semibold text-[#111827]">{columnMeta[status].label}</h4>
              <p className="mt-1 text-3xl font-bold text-[#4c1d95]">{counts[status]}</p>
            </div>

            <div className="card-list-tray m-3 mt-0 space-y-2.5">{renderColumn(status)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DbTasksList({ tasks }: { tasks: HousekeepingTaskView[] }) {
  const byStatus: Record<ColumnId, HousekeepingTaskView[]> = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  }

  return (
    <Shell
      counts={{ todo: byStatus.todo.length, in_progress: byStatus.in_progress.length, done: byStatus.done.length }}
      renderColumn={(status) =>
        byStatus[status].slice(0, 3).map((task) => (
          <div key={task.id} className="elevated-list-item flex items-start gap-2.5 p-3">
            <div className="mt-0.5 shrink-0">{getTaskIcon(status)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#111827]">
                {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
              </p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">{task.taskType}</p>
              <span className={`mt-2 inline-flex ${getPriorityColor(task.priority)}`}>{task.priority}</span>
            </div>
          </div>
        ))
      }
    />
  )
}

function MockTasksList() {
  const byStatus = {
    todo: housekeepingTasks.filter((t) => t.status === 'todo'),
    in_progress: housekeepingTasks.filter((t) => t.status === 'in_progress'),
    done: housekeepingTasks.filter((t) => t.status === 'done'),
  }

  return (
    <Shell
      counts={{ todo: byStatus.todo.length, in_progress: byStatus.in_progress.length, done: byStatus.done.length }}
      renderColumn={(status) =>
        byStatus[status].slice(0, 3).map((task) => (
          <div key={task.id} className="elevated-list-item flex items-start gap-2.5 p-3">
            <div className="mt-0.5 shrink-0">{getTaskIcon(status)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#111827]">Room {task.roomNumber}</p>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">{task.taskType}</p>
              <span className={`mt-2 inline-flex ${getPriorityColor(task.priority)}`}>{task.priority}</span>
            </div>
          </div>
        ))
      }
    />
  )
}

'use client'

import { housekeepingTasks } from '@/lib/mock-data'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'

export function TasksList() {
  const tasksByStatus = {
    todo: housekeepingTasks.filter((t) => t.status === 'todo'),
    in_progress: housekeepingTasks.filter((t) => t.status === 'in_progress'),
    done: housekeepingTasks.filter((t) => t.status === 'done'),
  }

  const getPriorityColor = (priority: string) => {
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

  const getTaskIcon = (status: string) => {
    switch (status) {
      case 'done':
        return <CheckCircle className="h-4 w-4 text-emerald-600" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-amber-600" />
      case 'todo':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const columnMeta = {
    todo: { label: 'To Do', tint: 'from-red-500/8' },
    in_progress: { label: 'In Progress', tint: 'from-amber-500/8' },
    done: { label: 'Done', tint: 'from-emerald-500/8' },
  } as const

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <h3 className="text-lg font-semibold text-[#111827]">Task Summary</h3>
        <p className="mt-1 text-sm text-[#5f6b78]">Track housekeeping work across all properties</p>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-6">
        {(['todo', 'in_progress', 'done'] as const).map((status) => (
          <div
            key={status}
            className={`overflow-hidden rounded-xl bg-gradient-to-b ${columnMeta[status].tint} to-transparent`}
          >
            <div className="border-b border-emerald-900/5 px-4 py-3">
              <h4 className="text-sm font-semibold text-[#111827]">{columnMeta[status].label}</h4>
              <p className="mt-1 text-3xl font-bold text-[#1d9e75]">{tasksByStatus[status].length}</p>
            </div>

            <div className="card-list-tray m-3 mt-0 space-y-2.5">
              {tasksByStatus[status].slice(0, 3).map((task) => (
                <div key={task.id} className="elevated-list-item flex items-start gap-2.5 p-3">
                  <div className="mt-0.5 shrink-0">{getTaskIcon(status)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#111827]">Room {task.roomNumber}</p>
                    <p className="mt-0.5 text-xs capitalize text-[#5f6b78]">{task.taskType}</p>
                    <span className={`mt-2 inline-flex ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

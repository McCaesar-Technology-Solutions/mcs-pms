'use client'

import { housekeepingTasks } from '@/lib/mock-data'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Sparkles,
  Search,
  Wrench,
  Package,
  ClipboardList,
  CalendarDays,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  clean: { label: 'Clean', icon: Sparkles },
  inspect: { label: 'Inspect', icon: Search },
  maintenance: { label: 'Maintenance', icon: Wrench },
  restock: { label: 'Restock', icon: Package },
}

function formatDueDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function HousekeepingKanban() {
  const tasksByStatus = {
    todo: housekeepingTasks.filter((t) => t.status === 'todo'),
    in_progress: housekeepingTasks.filter((t) => t.status === 'in_progress'),
    done: housekeepingTasks.filter((t) => t.status === 'done'),
  }

  const columns = [
    {
      id: 'todo',
      title: 'To Do',
      icon: AlertCircle,
      iconClass: 'text-red-600',
      headerTint: 'from-red-500/8 to-transparent',
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      icon: Clock,
      iconClass: 'text-amber-600',
      headerTint: 'from-amber-500/8 to-transparent',
    },
    {
      id: 'done',
      title: 'Done',
      icon: CheckCircle,
      iconClass: 'text-emerald-600',
      headerTint: 'from-emerald-500/8 to-transparent',
    },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {columns.map((column) => {
        const ColumnIcon = column.icon
        const tasks = tasksByStatus[column.id]

        return (
          <div key={column.id} className="surface-card overflow-hidden">
            <div
              className={`relative flex items-center gap-2 border-b border-emerald-900/5 bg-gradient-to-r ${column.headerTint} px-5 py-4`}
            >
              <ColumnIcon className={`h-5 w-5 ${column.iconClass}`} />
              <h3 className="text-lg font-semibold text-[#111827]">{column.title}</h3>
              <span className="ml-auto rounded-full bg-white/80 px-2.5 py-0.5 text-sm font-bold text-[#111827] shadow-elevation-1">
                {tasks.length}
              </span>
            </div>

            <div className="p-4">
              <div className="kanban-column-body space-y-3">
                {tasks.map((task) => {
                  const typeConfig = TASK_TYPE_CONFIG[task.taskType] ?? {
                    label: task.taskType,
                    icon: ClipboardList,
                  }
                  const TaskIcon = typeConfig.icon
                  const priority = task.priority as 'high' | 'medium' | 'low'

                  return (
                    <div
                      key={task.id}
                      className="elevated-list-item cursor-grab p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-bold text-[#111827]">Room {task.roomNumber}</p>
                          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#f4f8f6] px-2 py-1">
                            <TaskIcon className="h-3.5 w-3.5 text-[#1d9e75]" />
                            <span className="text-xs font-medium capitalize text-[#374151]">
                              {typeConfig.label}
                            </span>
                          </div>
                        </div>
                        <span className={`kanban-priority-pill kanban-priority-pill--${priority}`}>
                          {priority}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-emerald-900/6 pt-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="gradient-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">
                            {getInitials(task.assignedToName)}
                          </div>
                          <span className="truncate text-xs font-medium text-[#374151]">
                            {task.assignedToName}
                          </span>
                        </div>
                        <div className="kanban-task-meta flex shrink-0 items-center gap-1 text-xs">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>{formatDueDate(task.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {tasks.length === 0 && (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-900/10 bg-white/40 text-[#5f6b78]">
                    <ClipboardList className="h-6 w-6 opacity-40" />
                    <p className="text-sm font-medium">No tasks</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

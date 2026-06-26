'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
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
  Plus,
  Trash2,
  User,
  ShieldAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  createHousekeepingTask,
  deleteHousekeepingTask,
  assignHousekeepingTask,
  setHousekeepingTaskStatus,
} from '@/app/actions/housekeeping'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { HousekeepingTaskView } from '@/lib/housekeeping/task-view'
import type { HousekeepingTaskType, TaskPriority, TaskStatus } from '@/types'

const TASK_TYPE_CONFIG: Record<HousekeepingTaskType, { label: string; icon: LucideIcon }> = {
  clean: { label: 'Clean', icon: Sparkles },
  inspect: { label: 'Inspect', icon: Search },
  maintenance: { label: 'Maintenance', icon: Wrench },
  restock: { label: 'Restock', icon: Package },
}

const COLUMNS = [
  { id: 'todo', title: 'To Do', icon: AlertCircle, iconClass: 'text-red-600', headerTint: 'bg-red-500/8' },
  { id: 'in_progress', title: 'In Progress', icon: Clock, iconClass: 'text-amber-600', headerTint: 'bg-amber-500/8' },
  { id: 'done', title: 'Done', icon: CheckCircle, iconClass: 'text-[#3C216C]', headerTint: 'bg-[#3C216C]/8' },
] as const

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

function formatDueDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface HousekeepingKanbanProps {
  tasks: HousekeepingTaskView[]
  rooms: { id: string; number: string }[]
  staff: { id: string; name: string }[]
  canManage?: boolean
  currentUserId?: string
}

export function HousekeepingKanban({
  tasks,
  rooms,
  staff,
  canManage,
  currentUserId,
}: HousekeepingKanbanProps) {
  if (tasks.length === 0 && !canManage) {
    return <DataEmptyState message="No housekeeping tasks assigned yet." />
  }

  return (
    <DbKanban
      tasks={tasks}
      rooms={rooms}
      staff={staff}
      canManage={canManage}
      currentUserId={currentUserId}
    />
  )
}

function TaskStatusControls({
  task,
  canManage,
  currentUserId,
  isPending,
  onStatusChange,
}: {
  task: HousekeepingTaskView
  canManage?: boolean
  currentUserId?: string
  isPending: boolean
  onStatusChange: (status: TaskStatus, managerOverride?: boolean) => void
}) {
  const [overrideOpen, setOverrideOpen] = useState(false)
  const isAssignedToOther =
    canManage &&
    task.assignedTo &&
    currentUserId &&
    task.assignedTo !== currentUserId

  if (isAssignedToOther && !overrideOpen) {
    return (
      <div className="mt-3 border-t border-[#E9ECEF] pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-semibold text-foreground">
            {STATUS_LABEL[task.status]}
          </span>
          <button
            type="button"
            onClick={() => setOverrideOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#3C216C] hover:bg-[#3C216C]/5"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Override
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-[#E9ECEF] pt-3">
      {isAssignedToOther && overrideOpen && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          Override
        </span>
      )}
      <select
        value={task.status}
        onChange={(e) =>
          onStatusChange(e.target.value as TaskStatus, isAssignedToOther || overrideOpen)
        }
        disabled={isPending}
        className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
        aria-label="Task status"
      >
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>
      {isAssignedToOther && overrideOpen && (
        <button
          type="button"
          onClick={() => setOverrideOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

function DbKanban({
  tasks,
  rooms,
  staff,
  canManage,
  currentUserId,
}: {
  tasks: HousekeepingTaskView[]
  rooms: { id: string; number: string }[]
  staff: { id: string; name: string }[]
  canManage?: boolean
  currentUserId?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)

  const refreshFromRealtime = useCallback(() => {
    router.refresh()
  }, [router])

  useRealtimeRefresh('housekeeping', refreshFromRealtime)

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff])

  const unassignedCount = tasks.filter((t) => !t.assignedTo && t.status !== 'done').length
  const overdueCount = tasks.filter((t) => t.isOverdue).length
  const inspectCount = tasks.filter((t) => t.taskType === 'inspect' && t.status !== 'done').length

  const tasksByStatus: Record<TaskStatus, HousekeepingTaskView[]> = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    done: tasks.filter((t) => t.status === 'done'),
  }

  function run(action: () => Promise<{ success: boolean; error?: string }>, message = 'Task updated') {
    startTransition(async () => {
      const result = await action()
      if (result.success) {
        toast.success(message)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Update failed')
      }
    })
  }

  return (
    <div className="space-y-4">
      {(unassignedCount > 0 || overdueCount > 0 || inspectCount > 0) && canManage && (
        <div className="flex flex-wrap gap-2">
          {unassignedCount > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800">
              {unassignedCount} unassigned
            </span>
          )}
          {overdueCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-700">
              {overdueCount} overdue
            </span>
          )}
          {inspectCount > 0 && (
            <span className="rounded-full bg-[#3C216C]/10 px-3 py-1 text-xs font-semibold text-[#3C216C]">
              {inspectCount} awaiting inspection
            </span>
          )}
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setAdding(true)} className="bg-[#3C216C] text-white hover:bg-[#4c2a85]">
            <Plus className="mr-1.5 h-4 w-4" />
            Add task
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {COLUMNS.map((column) => {
          const ColumnIcon = column.icon
          const columnTasks = tasksByStatus[column.id]

          return (
            <div key={column.id} className="surface-card overflow-hidden">
              <div
                className={`relative flex items-center gap-2 border-b border-[#E9ECEF] ${column.headerTint} px-5 py-4`}
              >
                <ColumnIcon className={`h-5 w-5 ${column.iconClass}`} />
                <h3 className="text-lg font-semibold text-[#111827]">{column.title}</h3>
                <span className="ml-auto rounded-full bg-white/80 px-2.5 py-0.5 text-sm font-bold text-[#111827] shadow-elevation-1">
                  {columnTasks.length}
                </span>
              </div>

              <div className="p-4">
                <div className="kanban-column-body space-y-3">
                  {columnTasks.map((task) => {
                    const typeConfig = TASK_TYPE_CONFIG[task.taskType]
                    const TaskIcon = typeConfig.icon
                    const assigneeName = task.assignedTo ? staffById.get(task.assignedTo) ?? 'Unknown' : null

                    return (
                      <div
                        key={task.id}
                        className={`elevated-list-item p-4 ${!task.assignedTo && task.status !== 'done' ? 'ring-2 ring-amber-200/80' : ''} ${task.isOverdue ? 'ring-2 ring-red-200' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-base font-bold text-[#111827]">
                              {task.roomNumber ? `Room ${task.roomNumber}` : 'No room'}
                            </p>
                            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-[#faf8fc] px-2 py-1">
                              <TaskIcon className="h-3.5 w-3.5 text-[#4c1d95]" />
                              <span className="text-xs font-medium text-[#374151]">{typeConfig.label}</span>
                            </div>
                          </div>
                          <span className={`kanban-priority-pill kanban-priority-pill--${task.priority}`}>
                            {task.priority}
                          </span>
                        </div>

                        {task.notes && (
                          <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            {assigneeName ? (
                              <>
                                <div className="gradient-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">
                                  {getInitials(assigneeName)}
                                </div>
                                <span className="truncate font-medium text-[#374151]">{assigneeName}</span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1 font-semibold text-amber-700">
                                <User className="h-3.5 w-3.5" /> Unassigned
                              </span>
                            )}
                          </div>
                          {task.dueDate && (
                            <div
                              className={`flex shrink-0 items-center gap-1 ${task.isOverdue ? 'font-bold text-red-600' : 'text-muted-foreground'}`}
                            >
                              <CalendarDays className="h-3.5 w-3.5" />
                              <span>{formatDueDate(task.dueDate)}</span>
                            </div>
                          )}
                        </div>

                        {canManage && (
                          <>
                            <TaskStatusControls
                              task={task}
                              canManage={canManage}
                              currentUserId={currentUserId}
                              isPending={isPending}
                              onStatusChange={(status, managerOverride) =>
                                run(() =>
                                  setHousekeepingTaskStatus(task.id, status, { managerOverride }),
                                  status === 'done' && task.taskType === 'clean'
                                    ? 'Clean done — room sent for inspection'
                                    : status === 'done' && task.taskType === 'inspect'
                                      ? 'Inspection approved — room available'
                                      : 'Task updated',
                                )
                              }
                            />
                            <div className="mt-2 flex items-center gap-2">
                              <select
                                value={task.assignedTo ?? ''}
                                onChange={(e) =>
                                  run(() => assignHousekeepingTask(task.id, e.target.value || null))
                                }
                                disabled={isPending}
                                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-xs"
                                aria-label="Assign task"
                              >
                                <option value="">Unassigned</option>
                                {staff.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => run(() => deleteHousekeepingTask(task.id))}
                                disabled={isPending}
                                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                aria-label="Delete task"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}

                  {columnTasks.length === 0 && (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E9ECEF] bg-white/40 text-muted-foreground">
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

      {canManage && (
        <AddTaskModal
          open={adding}
          onClose={() => setAdding(false)}
          rooms={rooms}
          staff={staff}
          onCreated={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function AddTaskModal({
  open,
  onClose,
  rooms,
  staff,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  rooms: { id: string; number: string }[]
  staff: { id: string; name: string }[]
  onCreated: () => void
}) {
  const [roomId, setRoomId] = useState('')
  const [taskType, setTaskType] = useState<HousekeepingTaskType>('clean')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate() {
    setError(null)
    setSubmitting(true)
    const result = await createHousekeepingTask({
      roomId,
      taskType,
      priority,
      assignedTo: assignedTo || undefined,
      dueDate: dueDate || undefined,
      notes: notes || undefined,
    })
    setSubmitting(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setRoomId('')
    setTaskType('clean')
    setPriority('medium')
    setAssignedTo('')
    setDueDate('')
    setNotes('')
    onCreated()
  }

  return (
    <CenteredModal open={open} onClose={onClose} className="max-w-md" aria-label="Add housekeeping task">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold">Add task</h3>
        <p className="modal-panel-subtle text-sm">Create a housekeeping or maintenance task.</p>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <div className="space-y-2">
          <Label>Room</Label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">Select room</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Type</Label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as HousekeepingTaskType)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="clean">Clean</option>
              <option value="inspect">Inspect</option>
              <option value="maintenance">Maintenance</option>
              <option value="restock">Restock</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Assign to</Label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any details…" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button
          onClick={handleCreate}
          disabled={submitting || !roomId}
          className="w-full bg-[#3C216C] text-white"
        >
          {submitting ? 'Creating…' : 'Create task'}
        </Button>
      </ModalFooter>
    </CenteredModal>
  )
}

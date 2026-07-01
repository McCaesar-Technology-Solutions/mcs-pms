'use client'

import { useState, useTransition } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { toast } from 'sonner'
import { createOpsCalendarEvent, deleteOpsCalendarEvent } from '@/app/actions/ops-calendar'
import { OPS_EVENT_LABELS, isImportantOpsCategory } from '@/lib/ops-calendar/categories'
import type { OpsCalendarEventRow } from '@/lib/data/ops-calendar'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'

interface OpsCalendarPanelProps {
  events: OpsCalendarEventRow[]
  /** Owner, manager, receptionist can add/remove events. */
  canManage?: boolean
}

function panelDescription(canManage: boolean): string {
  if (canManage) {
    return 'Training, meetings, and property events this week. Team sees this on their dashboards; optional SMS/email and Property team chat for important items.'
  }
  return 'Shared schedule for this week — same events managers add for the whole team.'
}

function formatWhen(event: OpsCalendarEventRow) {
  const start = new Date(event.startsAt)
  if (event.allDay) {
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return start.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function OpsCalendarPanel({ events, canManage = false }: OpsCalendarPanelProps) {
  const [creating, setCreating] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="surface-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[var(--brand-purple)]" />
            <h3 className="text-base font-semibold text-foreground">Ops calendar</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{panelDescription(Boolean(canManage))}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add event
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <DataEmptyState
          borderless
          icon={CalendarDays}
          title="Nothing on the calendar"
          message="Schedule maintenance, inspections, and team events for the week ahead."
          action={
            canManage ? (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="app-btn app-btn-primary inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add first event
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="ops-calendar-row">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(event)}
                  {event.roomNumber ? ` · Room ${event.roomNumber}` : ''}
                </p>
                <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {OPS_EVENT_LABELS[event.category] ?? event.category}
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deleteOpsCalendarEvent(event.id)
                      if (result.success) toast.success('Event removed')
                      else toast.error(result.error ?? 'Delete failed')
                    })
                  }}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete event"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {creating && <OpsEventFormModal onClose={() => setCreating(false)} onDone={() => setCreating(false)} />}
    </div>
  )
}

function OpsEventFormModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<OpsCalendarEventRow['category']>('general')
  const [startsAt, setStartsAt] = useState('')
  const [notes, setNotes] = useState('')
  const [notifyTeam, setNotifyTeam] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setError(null)
    if (!startsAt) {
      setError('Start time is required.')
      return
    }
    startTransition(async () => {
      const result = await createOpsCalendarEvent({
        title,
        category: category as 'training' | 'meeting' | 'guest_service' | 'maintenance' | 'event' | 'general',
        startsAt: new Date(startsAt).toISOString(),
        notes: notes || undefined,
        notifyTeam,
      })
      if (result.success) {
        toast.success(notifyTeam ? 'Event added — team notified' : 'Event added')
        onDone()
      } else {
        setError(result.error ?? 'Could not save event')
      }
    })
  }

  return (
    <CenteredModal open onClose={onClose} aria-label="Add calendar event">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Add ops event</h3>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="app-field w-full" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as OpsCalendarEventRow['category'])}
          className="app-field w-full"
        >
          {Object.entries(OPS_EVENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="app-field w-full" />
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="app-field w-full" />
        <label className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={notifyTeam}
            onChange={(e) => setNotifyTeam(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Notify team by SMS and email (respects notification settings).{' '}
            {isImportantOpsCategory(category) ? (
              <span className="text-foreground">Also posts to Property team in Messages.</span>
            ) : (
              <span>General events stay on the dashboard only.</span>
            )}
          </span>
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-ghost">Cancel</button>
        <button type="button" disabled={pending} onClick={save} className="app-btn app-btn-primary">Save</button>
      </ModalFooter>
    </CenteredModal>
  )
}

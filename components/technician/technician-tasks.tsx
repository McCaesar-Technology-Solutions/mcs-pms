'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Droplets,
  Zap,
  Wind,
  Armchair,
  Sparkles,
  Volume2,
  HelpCircle,
  ClipboardList,
  CalendarClock,
  RefreshCw,
} from 'lucide-react'
import {
  getTechnicianComplaints,
  markComplaintComplete,
  scheduleTechnicianComplaintVisit,
  startTechnicianComplaint,
} from '@/app/actions/complaints'
import { fetchComplaintEstimate } from '@/app/actions/complaint-estimates'
import { StaffComplaintMessageThread } from '@/components/complaints/staff-complaint-message-thread'
import { OptionalInvoicePanel } from '@/components/technician/optional-invoice-panel'
import { TechnicianComplaintPhoto } from '@/components/technician/technician-complaint-photo'
import { TechnicianJobProgress } from '@/components/technician/technician-job-progress'
import { TechnicianNextStepBanner } from '@/components/technician/technician-next-step-banner'
import { ComplaintEstimateCard } from '@/components/complaints/complaint-estimate-card'
import { ScheduleVisitForm } from '@/components/complaints/schedule-visit-form'
import { PhoneContact } from '@/components/ui/phone-contact'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import { guestComplaintReference } from '@/lib/complaints/guest-progress'
import { getTechnicianNextAction, technicianScrollTarget } from '@/lib/complaints/technician-progress'
import type { TechnicianNextAction } from '@/lib/complaints/technician-progress'
import { telHref } from '@/lib/phone'
import {
  canMarkComplete,
  canStartJob,
  canSubmitInvoice,
  canTechnicianScheduleVisit,
  isPendingCompletion,
  isPendingEstimate,
  technicianStatusLabel,
} from '@/lib/complaints/workflow'
import { formatComplaintVisit } from '@/lib/complaints/visit'
import type { Complaint, ComplaintCategory, ComplaintEstimate } from '@/types'

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const categoryIcons: Record<ComplaintCategory, typeof Droplets> = {
  plumbing: Droplets,
  electrical: Zap,
  hvac: Wind,
  furniture: Armchair,
  cleaning: Sparkles,
  noise: Volume2,
  other: HelpCircle,
}

const TECHNICIAN_QUICK_REPLIES = [
  "Hi, I'm your technician. When is a good time to visit your room?",
  "I'm on my way to your room now.",
  "I've started working on your issue.",
  'Please confirm in your guest portal when the repair looks good to you.',
] as const

function priorityPillClass(priority: string | null | undefined) {
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

function statusPillClass(c: Complaint) {
  if (isPendingEstimate(c) || isPendingCompletion(c)) return 'technician-pill--status-waiting'
  if (canStartJob(c)) return 'technician-pill--status-ready'
  if (c.status === 'assigned' || c.status === 'in_progress') return 'technician-pill--status-active'
  if (c.status === 'resolved') return 'technician-pill--status-done'
  if (c.status === 'rejected') return 'technician-pill--status-rejected'
  return 'technician-pill--status-default'
}

export function TechnicianTasks() {
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [estimates, setEstimates] = useState<Record<string, ComplaintEstimate | null>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [listRefreshing, setListRefreshing] = useState(false)
  const expandedRef = useRef<string | null>(null)
  expandedRef.current = expandedId

  const load = useCallback(async () => {
    const result = await getTechnicianComplaints(tab === 'completed')
    if (result.success && result.data) {
      const sorted = [...result.data].sort(
        (a, b) =>
          (priorityOrder[a.priority ?? 'medium'] ?? 2) -
          (priorityOrder[b.priority ?? 'medium'] ?? 2),
      )
      setComplaints(sorted)
    }
  }, [tab])

  const refreshFromRealtime = useCallback(async () => {
    await load()
    const id = expandedRef.current
    if (id) {
      const result = await fetchComplaintEstimate(id)
      if (result.success) {
        setEstimates((prev) => ({ ...prev, [id]: result.data ?? null }))
      }
    }
  }, [load])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh('complaints', refreshFromRealtime)

  async function loadEstimate(complaintId: string) {
    const result = await fetchComplaintEstimate(complaintId)
    if (result.success) {
      setEstimates((prev) => ({ ...prev, [complaintId]: result.data ?? null }))
    }
  }

  async function handleStart(id: string) {
    setLoading(id)
    const result = await startTechnicianComplaint(id)
    setLoading(null)
    if (!result.success) {
      toast.error(result.error ?? 'Could not start job.')
      return
    }
    toast.success('Job marked as started.')
    await load()
  }

  async function handleComplete(id: string) {
    setLoading(id)
    const result = await markComplaintComplete(id)
    setLoading(null)
    if (!result.success) {
      toast.error(result.error ?? 'Could not mark job complete.')
      return
    }
    toast.success('Job sent to manager for approval.')
    await load()
  }

  async function refreshList() {
    setListRefreshing(true)
    await load()
    setListRefreshing(false)
  }

  function toggleExpanded(c: Complaint) {
    const next = expandedId === c.id ? null : c.id
    setExpandedId(next)
    if (next && !estimates[c.id]) void loadEstimate(c.id)
  }

  function scrollToElement(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function handleTechnicianNextAction(c: Complaint, action: TechnicianNextAction) {
    if (action.actionKind === 'call' && c.guests?.phone) {
      const href = telHref(c.guests.phone)
      if (href) window.location.href = href
      if (action.scrollTargetId) {
        setExpandedId(c.id)
        setTimeout(() => scrollToElement(action.scrollTargetId!), 120)
      }
      return
    }
    if (action.actionKind === 'start') {
      await handleStart(c.id)
      return
    }
    if (action.actionKind === 'complete') {
      await handleComplete(c.id)
      return
    }
    setExpandedId(c.id)
    if (action.scrollTargetId) {
      setTimeout(() => scrollToElement(action.scrollTargetId!), 120)
    }
  }

  return (
    <section className="technician-section">
      <div className="technician-section__toolbar">
        <div>
          <p className="technician-section__title">Maintenance jobs</p>
          <p className="technician-section__hint">Guest issues assigned to you — urgent first.</p>
        </div>
        <button
          type="button"
          onClick={() => void refreshList()}
          disabled={listRefreshing}
          className="technician-btn technician-btn--ghost text-xs"
          aria-label="Refresh task list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${listRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="technician-segment" role="tablist" aria-label="Maintenance task list">
        {(['active', 'completed'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={t === 'active' ? 'technician-tab-active' : 'technician-tab-completed'}
            aria-selected={tab === t}
            aria-controls={t === 'active' ? 'technician-panel-active' : 'technician-panel-completed'}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={`technician-segment__btn ${
              tab === t ? 'technician-segment__btn--active' : ''
            }`}
          >
            {t === 'active' ? 'My tasks' : 'Completed (30d)'}
          </button>
        ))}
      </div>

      <div
        className="technician-job-list"
        role="tabpanel"
        id={tab === 'active' ? 'technician-panel-active' : 'technician-panel-completed'}
        aria-labelledby={tab === 'active' ? 'technician-tab-active' : 'technician-tab-completed'}
      >
        {complaints.map((c) => {
          const expanded = expandedId === c.id
          const Icon = categoryIcons[c.category]
          const roomNumber =
            c.room && typeof c.room === 'object' && 'number' in c.room
              ? (c.room as { number: string }).number
              : '—'
          const roomsJoin =
            (c as Complaint & { rooms?: { number: string } }).rooms?.number ?? roomNumber
          const isRejected = c.status === 'rejected'
          const isPending = isPendingEstimate(c) || isPendingCompletion(c)
          const estimate = estimates[c.id]
          const nextAction = getTechnicianNextAction(c)
          const showGuestContact =
            Boolean(c.guests?.phone) &&
            c.status !== 'resolved' &&
            (nextAction?.type === 'contact_guest' ||
              nextAction?.type === 'schedule_visit' ||
              nextAction?.type === 'start_job' ||
              nextAction?.type === 'mark_complete' ||
              nextAction?.type === 'rework')
          const showChat =
            c.status !== 'resolved' && Boolean(c.guest_id ?? c.guests?.phone)

          return (
            <article
              key={c.id}
              className={`technician-job-card ${expanded ? 'technician-job-card--open' : ''} ${
                isRejected ? 'technician-job-card--alert' : ''
              } ${isPending ? 'technician-job-card--pending' : ''}`}
            >
              <div className="technician-job-card__summary">
                <div
                  className={`technician-job-card__icon ${
                    isRejected
                      ? 'technician-job-card__icon--alert'
                      : isPending
                        ? 'technician-job-card__icon--pending'
                        : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    className="w-full text-left"
                    onClick={() => toggleExpanded(c)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-[var(--tech-fg)]">Room {roomsJoin}</p>
                      <span className={`technician-pill ${priorityPillClass(c.priority)}`}>
                        {c.priority ?? 'medium'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium capitalize">
                      {c.category}
                      <span className="ml-2 font-mono text-[10px] text-[var(--tech-fg-subtle)]">
                        {guestComplaintReference(c.id)}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--tech-fg-muted)]">{c.description}</p>
                    <span className={`technician-pill mt-2 ${statusPillClass(c)}`}>
                      {technicianStatusLabel(c)}
                    </span>
                  </button>
                  {!expanded && nextAction?.actionLabel && nextAction.actionKind !== 'none' && (
                    <button
                      type="button"
                      onClick={() => void handleTechnicianNextAction(c, nextAction)}
                      className="technician-job-card__next mt-2 w-full text-left"
                    >
                      Next: {nextAction.actionLabel} →
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
                  className="technician-portal-icon-btn mt-0.5 shrink-0"
                  onClick={() => toggleExpanded(c)}
                >
                  {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>

              {expanded && (
                <div className="technician-job-detail">
                  {nextAction && (
                    <TechnicianNextStepBanner
                      action={nextAction}
                      loading={loading === c.id}
                      onAction={() => void handleTechnicianNextAction(c, nextAction)}
                    />
                  )}

                  <TechnicianComplaintPhoto
                    complaintId={c.id}
                    hasPhoto={Boolean(c.guest_photo_path)}
                  />

                  <div className="technician-detail-card">
                    <TechnicianJobProgress complaint={c} />
                  </div>

                  {showGuestContact && c.guests?.phone && (
                    <div
                      id={technicianScrollTarget(c.id, 'contact')}
                      className="technician-detail-card"
                    >
                      <PhoneContact
                        name={c.guests.name ?? 'Guest'}
                        phone={c.guests.phone}
                        label={`Guest${c.guests.name ? ` · ${c.guests.name}` : ''}`}
                      />
                    </div>
                  )}

                  {canTechnicianScheduleVisit(c) && (
                    <div
                      id={technicianScrollTarget(c.id, 'visit')}
                      className="technician-detail-card"
                    >
                      <ScheduleVisitForm
                        complaintId={c.id}
                        scheduledVisitAt={c.scheduled_visit_at}
                        onSchedule={scheduleTechnicianComplaintVisit}
                        onSuccess={load}
                        title="Agree visit with guest"
                        hint="Call the guest first, then enter the time you both agreed on."
                      />
                    </div>
                  )}

                  {c.scheduled_visit_at && !canTechnicianScheduleVisit(c) && (
                    <div className="technician-detail-card flex items-start gap-2">
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-purple)]" />
                      <div>
                        <p className="technician-eyebrow">Agreed visit</p>
                        <p className="mt-1 text-sm font-medium">
                          {formatComplaintVisit(c.scheduled_visit_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {c.rejection_note && (
                    <div
                      id={technicianScrollTarget(c.id, 'rejection')}
                      className="technician-detail-card technician-detail-card--danger"
                    >
                      <p className="font-semibold">Manager note</p>
                      <p className="mt-1">{c.rejection_note}</p>
                    </div>
                  )}

                  {canMarkComplete(c) && (
                    <button
                      id={technicianScrollTarget(c.id, 'complete')}
                      type="button"
                      disabled={loading === c.id}
                      onClick={() => handleComplete(c.id)}
                      className="technician-btn technician-btn--primary w-full"
                    >
                      {loading === c.id ? 'Submitting…' : 'Request sign-off'}
                    </button>
                  )}

                  {canStartJob(c) && c.status === 'assigned' && (
                    <button
                      id={technicianScrollTarget(c.id, 'start')}
                      type="button"
                      disabled={loading === c.id}
                      onClick={() => handleStart(c.id)}
                      className="technician-btn technician-btn--accent w-full"
                    >
                      {loading === c.id ? 'Starting…' : 'Mark as started (optional)'}
                    </button>
                  )}

                  {showChat && (
                    <div id={technicianScrollTarget(c.id, 'chat')}>
                      <StaffComplaintMessageThread
                      complaintId={c.id}
                      guestName={c.guests?.name}
                      roomNumber={roomsJoin}
                      complaintCategory={c.category}
                      quickReplies={TECHNICIAN_QUICK_REPLIES}
                      compact
                      messagePlaceholder="Message guest…"
                    />
                    </div>
                  )}

                  {canSubmitInvoice(c) && (
                    <OptionalInvoicePanel
                      complaintId={c.id}
                      roomNumber={c.rooms?.number ?? c.room?.number ?? null}
                      category={c.category}
                      onSubmitted={() => {
                        void loadEstimate(c.id)
                        void load()
                      }}
                    />
                  )}

                  {estimate &&
                    (c.status === 'assigned' ||
                      c.status === 'in_progress' ||
                      isPendingCompletion(c)) && (
                      <ComplaintEstimateCard estimate={estimate} />
                    )}

                  {c.status === 'resolved' && c.resolved_at && (
                    <p className="text-center text-xs text-muted-foreground">
                      Resolved {new Date(c.resolved_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </article>
          )
        })}

        {complaints.length === 0 && (
          <div className="technician-empty">
            <div className="technician-empty__icon">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[var(--tech-fg)]">
              {tab === 'active' ? 'No active maintenance jobs' : 'No completed jobs yet'}
            </p>
            <p className="mt-1 text-sm text-[var(--tech-fg-muted)]">
              {tab === 'active'
                ? 'New assignments will show up here.'
                : 'Finished jobs from the last 30 days appear here.'}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

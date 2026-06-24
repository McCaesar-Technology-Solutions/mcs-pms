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

function priorityBadge(priority: string | null | undefined) {
  switch (priority) {
    case 'urgent':
      return 'bg-[#D85A30]/12 text-[#D85A30]'
    case 'high':
      return 'bg-orange-100 text-orange-800'
    case 'medium':
      return 'bg-[#D4A62E]/20 text-[#B88D24]'
    default:
      return 'bg-[#E9ECEF]/80 text-[#5E5872]'
  }
}

function statusBadge(c: Complaint) {
  if (isPendingEstimate(c) || isPendingCompletion(c)) return 'bg-[#D85A30]/12 text-[#D85A30]'
  if (canStartJob(c)) return 'bg-emerald-500/10 text-emerald-700'
  if (c.status === 'assigned' || c.status === 'in_progress') return 'bg-[#D4A62E]/15 text-[#B88D24]'
  if (c.status === 'resolved') return 'bg-emerald-500/10 text-emerald-700'
  if (c.status === 'rejected') return 'bg-red-500/10 text-red-700'
  return 'bg-[#3C216C]/10 text-[#3C216C]'
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
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-8 pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Your jobs</p>
        <button
          type="button"
          onClick={() => void refreshList()}
          disabled={listRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#3C216C] shadow-elevation-1 hover:shadow-elevation-2 disabled:opacity-50"
          aria-label="Refresh task list"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${listRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-5 flex rounded-2xl bg-white p-1 shadow-elevation-1" role="tablist" aria-label="Task list">
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
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tab === t
                ? 'bg-[#3C216C] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'active' ? 'My tasks' : 'Completed (30d)'}
          </button>
        ))}
      </div>

      <div
        className="space-y-3"
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
              className={`overflow-hidden rounded-2xl bg-white shadow-elevation-1 transition-all ${
                expanded ? 'shadow-elevation-2' : 'hover:-translate-y-px hover:shadow-elevation-2'
              } ${isRejected ? 'ring-2 ring-red-500/10' : ''} ${isPending ? 'ring-2 ring-[#D85A30]/10' : ''}`}
            >
              <div className="flex w-full items-start gap-3 p-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    isRejected
                      ? 'bg-red-500/10'
                      : isPending
                        ? 'bg-[#D85A30]/12'
                        : 'bg-[#3C216C]/6'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isRejected
                        ? 'text-red-600'
                        : isPending
                          ? 'text-[#D85A30]'
                          : 'text-[#3C216C]'
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    className="w-full text-left"
                    onClick={() => toggleExpanded(c)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-bold text-[#3C216C]">Room {roomsJoin}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge(c.priority)}`}
                      >
                        {c.priority ?? 'medium'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium capitalize text-foreground">
                      {c.category}
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                        {guestComplaintReference(c.id)}
                      </span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c)}`}
                    >
                      {technicianStatusLabel(c)}
                    </span>
                  </button>
                  {!expanded && nextAction?.actionLabel && nextAction.actionKind !== 'none' && (
                    <button
                      type="button"
                      onClick={() => void handleTechnicianNextAction(c, nextAction)}
                      className="mt-2 block w-full rounded-lg bg-[#3C216C]/8 px-2.5 py-2 text-left text-xs font-semibold text-[#3C216C] hover:bg-[#3C216C]/12"
                    >
                      Next: {nextAction.actionLabel} →
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
                  className="mt-1 shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-[#3C216C]/5"
                  onClick={() => toggleExpanded(c)}
                >
                  {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </div>

              {expanded && (
                <div className="mx-4 mb-4 space-y-3 rounded-xl bg-[#F7F4FB] p-4">
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

                  <div className="rounded-xl bg-white p-3.5 shadow-elevation-1">
                    <TechnicianJobProgress complaint={c} />
                  </div>

                  {showGuestContact && c.guests?.phone && (
                    <div
                      id={technicianScrollTarget(c.id, 'contact')}
                      className="rounded-xl bg-white p-3 shadow-elevation-1"
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
                      className="rounded-xl bg-white p-3 shadow-elevation-1"
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
                    <div className="flex items-start gap-2 rounded-xl bg-white p-3 shadow-elevation-1">
                      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#3C216C]" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Agreed visit
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {formatComplaintVisit(c.scheduled_visit_at)}
                        </p>
                      </div>
                    </div>
                  )}

                  {c.rejection_note && (
                    <div
                      id={technicianScrollTarget(c.id, 'rejection')}
                      className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 shadow-elevation-1"
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
                      className="w-full rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-60"
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
                      className="w-full rounded-xl border border-[#D4A62E]/40 bg-[#D4A62E]/10 py-2.5 text-sm font-semibold text-[#8B6914] shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-60"
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
          <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-elevation-1">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3C216C]/8">
              <ClipboardList className="h-5 w-5 text-[#3C216C]" />
            </div>
            <p className="font-medium text-foreground">
              {tab === 'active' ? 'No active tasks' : 'No completed tasks yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'active'
                ? 'New assignments will show up here.'
                : 'Finished jobs from the last 30 days appear here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

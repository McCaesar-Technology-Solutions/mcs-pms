'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ChevronRight,
  Droplets,
  Zap,
  Wind,
  Armchair,
  Sparkles,
  Volume2,
  HelpCircle,
  ClipboardList,
  RefreshCw,
} from 'lucide-react'
import {
  getTechnicianComplaints,
  markComplaintComplete,
  startTechnicianComplaint,
} from '@/app/actions/complaints'
import { fetchComplaintEstimate } from '@/app/actions/complaint-estimates'
import { TechnicianJobDetail } from '@/components/technician/technician-job-detail'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import { guestComplaintReference } from '@/lib/complaints/guest-progress'
import { getTechnicianNextAction, technicianScrollTarget } from '@/lib/complaints/technician-progress'
import type { TechnicianNextAction } from '@/lib/complaints/technician-progress'
import { telHref } from '@/lib/phone'
import {
  canStartJob,
  isPendingCompletion,
  isPendingEstimate,
  technicianStatusLabel,
} from '@/lib/complaints/workflow'
import { complaintMatchesQuery } from '@/lib/complaints/search-filter'
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

function roomLabelFor(c: Complaint) {
  const roomNumber =
    c.room && typeof c.room === 'object' && 'number' in c.room
      ? (c.room as { number: string }).number
      : '—'
  return (c as Complaint & { rooms?: { number: string } }).rooms?.number ?? roomNumber
}

interface TechnicianTasksProps {
  onJobDetailOpen?: (open: boolean) => void
  searchQuery?: string
}

export function TechnicianTasks({ onJobDetailOpen, searchQuery = '' }: TechnicianTasksProps) {
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'messages'>('overview')
  const [focusTarget, setFocusTarget] = useState<string | null>(null)
  const [estimates, setEstimates] = useState<Record<string, ComplaintEstimate | null>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [listRefreshing, setListRefreshing] = useState(false)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedId

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
    const id = selectedRef.current
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

  const selected = complaints.find((c) => c.id === selectedId) ?? null

  const visibleComplaints = searchQuery.trim()
    ? complaints.filter((c) => complaintMatchesQuery(c, searchQuery))
    : complaints

  async function loadEstimate(complaintId: string) {
    const result = await fetchComplaintEstimate(complaintId)
    if (result.success) {
      setEstimates((prev) => ({ ...prev, [complaintId]: result.data ?? null }))
    }
  }

  function openJob(
    c: Complaint,
    opts?: { tab?: 'overview' | 'messages'; scrollTarget?: string },
  ) {
    setSelectedId(c.id)
    setDetailTab(opts?.tab ?? 'overview')
    setFocusTarget(opts?.scrollTarget ?? null)
    if (!estimates[c.id]) void loadEstimate(c.id)
    onJobDetailOpen?.(true)
  }

  function closeJob() {
    setSelectedId(null)
    setFocusTarget(null)
    onJobDetailOpen?.(false)
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

  async function handleTechnicianNextAction(c: Complaint, action: TechnicianNextAction) {
    if (action.actionKind === 'call' && c.guests?.phone) {
      const href = telHref(c.guests.phone)
      if (href) window.location.href = href
      if (action.scrollTargetId) {
        openJob(c, { scrollTarget: action.scrollTargetId })
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
    if (action.actionKind === 'message' || action.scrollTargetId?.includes('chat')) {
      openJob(c, { tab: 'messages', scrollTarget: action.scrollTargetId })
      return
    }
    openJob(c, { scrollTarget: action.scrollTargetId })
  }

  return (
    <>
      <section className="technician-section">
        <div className="technician-section__toolbar technician-section__toolbar--compact">
          <div className="technician-segment technician-segment--inline" role="tablist" aria-label="Maintenance task list">
            {(['active', 'completed'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={t === 'active' ? 'technician-tab-active' : 'technician-tab-completed'}
                aria-selected={tab === t}
                aria-controls={t === 'active' ? 'technician-panel-active' : 'technician-panel-completed'}
                tabIndex={tab === t ? 0 : -1}
                onClick={() => {
                  setTab(t)
                  closeJob()
                }}
                className={`technician-segment__btn ${
                  tab === t ? 'technician-segment__btn--active' : ''
                }`}
              >
                {t === 'active' ? 'Active' : 'Done'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void refreshList()}
            disabled={listRefreshing}
            className="technician-portal-icon-btn shrink-0"
            aria-label="Refresh task list"
          >
            <RefreshCw className={`h-4 w-4 ${listRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div
          className="technician-job-list technician-job-list--compact"
          role="tabpanel"
          id={tab === 'active' ? 'technician-panel-active' : 'technician-panel-completed'}
          aria-labelledby={tab === 'active' ? 'technician-tab-active' : 'technician-tab-completed'}
        >
          {visibleComplaints.map((c) => {
            const Icon = categoryIcons[c.category]
            const roomsJoin = roomLabelFor(c)
            const isRejected = c.status === 'rejected'
            const isPending = isPendingEstimate(c) || isPendingCompletion(c)
            const nextAction = getTechnicianNextAction(c)

            return (
              <article
                key={c.id}
                className={`technician-job-card technician-job-card--row ${
                  isRejected ? 'technician-job-card--alert' : ''
                } ${isPending ? 'technician-job-card--pending' : ''}`}
              >
                <button
                  type="button"
                  className="technician-job-card__row-btn"
                  onClick={() => openJob(c)}
                >
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
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">Room {roomsJoin}</p>
                      <span className={`technician-pill ${priorityPillClass(c.priority)}`}>
                        {c.priority ?? 'medium'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs capitalize text-[var(--tech-fg-muted)]">
                      {c.category} · {technicianStatusLabel(c)}
                    </p>
                    {c.description && (
                      <p className="mt-0.5 truncate text-xs text-[var(--tech-fg-subtle)]">{c.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--tech-fg-subtle)]" />
                </button>
                {nextAction?.actionLabel && nextAction.actionKind !== 'none' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleTechnicianNextAction(c, nextAction)
                    }}
                    className="technician-job-card__next mx-3 mb-3 w-[calc(100%-1.5rem)] text-left"
                  >
                    {nextAction.actionLabel} →
                  </button>
                )}
              </article>
            )
          })}

          {complaints.length === 0 && (
            <div className="technician-empty technician-empty--compact">
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

      {selected && (
        <TechnicianJobDetail
          complaint={selected}
          estimate={estimates[selected.id]}
          loading={loading === selected.id}
          categoryIcon={categoryIcons[selected.category]}
          roomLabel={roomLabelFor(selected)}
          priorityClass={priorityPillClass(selected.priority)}
          statusClass={statusPillClass(selected)}
          initialTab={detailTab}
          focusTarget={focusTarget}
          onClose={closeJob}
          onReload={load}
          onReloadEstimate={() => void loadEstimate(selected.id)}
          onNextAction={(action) => void handleTechnicianNextAction(selected, action)}
          onStart={() => void handleStart(selected.id)}
          onComplete={() => void handleComplete(selected.id)}
        />
      )}
    </>
  )
}

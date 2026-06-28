'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, MessageCircle, X } from 'lucide-react'
import { approveGuestComplaintCompletion, getGuestComplaintActivity } from '@/app/actions/guest'
import { ScheduledVisitDisplay } from '@/components/complaints/schedule-visit-form'
import { guestStatusLabel } from '@/components/complaints/complaints-overview'
import { GuestComplaintProgress } from '@/components/guest/guest-complaint-progress'
import { GuestNextStepBanner } from '@/components/guest/guest-next-step-banner'
import { guestComplaintReference } from '@/lib/complaints/guest-progress'
import { getGuestNextAction } from '@/lib/complaints/guest-next-action'
import type { GuestNextActionFocus } from '@/lib/complaints/guest-next-action'
import { canGuestApproveCompletion } from '@/lib/complaints/workflow'
import type { Complaint } from '@/types'

interface GuestComplaintCardProps {
  complaint: Complaint
  onUpdated: () => void
  onOpenChat?: () => void
  forceOpen?: boolean
  focusSection?: GuestNextActionFocus | null
  onFocusHandled?: () => void
  onNextStep?: (complaintId: string, focus: GuestNextActionFocus) => void
}

export function GuestComplaintCard({
  complaint,
  onUpdated,
  onOpenChat,
  forceOpen = false,
  focusSection = null,
  onFocusHandled,
  onNextStep,
}: GuestComplaintCardProps) {
  const [detailOpen, setDetailOpen] = useState(forceOpen)
  const [mounted, setMounted] = useState(false)
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [activity, setActivity] = useState<{ id: string; label: string; createdAt: string }[]>([])
  const bodyRef = useRef<HTMLDivElement>(null)

  const canApprove = canGuestApproveCompletion(complaint)
  const nextAction = getGuestNextAction(complaint)
  const awaitingVisit =
    !complaint.scheduled_visit_at &&
    ['open', 'assigned', 'in_progress', 'rejected'].includes(complaint.status ?? '')

  const loadActivity = useCallback(async () => {
    const result = await getGuestComplaintActivity(complaint.id)
    if (result.success && result.data) setActivity(result.data.events)
  }, [complaint.id])

  const closeDetail = useCallback(() => {
    setDetailOpen(false)
    onFocusHandled?.()
  }, [onFocusHandled])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (forceOpen) setDetailOpen(true)
  }, [forceOpen])

  useEffect(() => {
    if (detailOpen) void loadActivity()
  }, [detailOpen, loadActivity])

  useEffect(() => {
    if (!detailOpen) return

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [detailOpen, closeDetail])

  useEffect(() => {
    if (!focusSection || !detailOpen) return
    const targetId =
      focusSection === 'approve'
        ? `guest-approve-${complaint.id}`
        : focusSection === 'chat'
          ? `guest-chat-${complaint.id}`
          : `guest-issue-${complaint.id}`
    const timer = window.setTimeout(() => {
      const root = bodyRef.current
      const target = root?.querySelector<HTMLElement>(`#${targetId}`) ?? document.getElementById(targetId)
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      onFocusHandled?.()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [focusSection, detailOpen, complaint.id, onFocusHandled])

  async function handleApprove() {
    setApproveLoading(true)
    setApproveError(null)
    const result = await approveGuestComplaintCompletion(complaint.id)
    setApproveLoading(false)
    if (!result.success) {
      setApproveError(result.error ?? 'Could not confirm completion.')
      return
    }
    onUpdated()
    void loadActivity()
  }

  function openDetail() {
    setDetailOpen(true)
  }

  const detailContent = (
    <>
      {nextAction && (
        <GuestNextStepBanner
          action={nextAction}
          variant="inline"
          onAction={(action) => {
            if (action.focus === 'chat') {
              closeDetail()
              onOpenChat?.()
              return
            }
            onNextStep?.(complaint.id, action.focus)
          }}
        />
      )}

      <GuestComplaintProgress complaint={complaint} />

      {(complaint.scheduled_visit_at || awaitingVisit) && (
        <div className="guest-inset-row">
          <ScheduledVisitDisplay
            scheduledVisitAt={complaint.scheduled_visit_at}
            variant="light"
            pendingMessage={
              awaitingVisit ? 'Your technician will call you to agree a visit time.' : undefined
            }
          />
        </div>
      )}

      {activity.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest guest-text-subtle">
            Recent updates
          </p>
          <ul className="mt-2 space-y-2">
            {activity.slice(-4).map((ev) => (
              <li key={ev.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="guest-text-muted">{ev.label}</span>
                <span className="shrink-0 guest-text-subtle">
                  {new Date(ev.createdAt).toLocaleString('en-GB', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onOpenChat && complaint.status !== 'resolved' && (
        <button
          id={`guest-chat-${complaint.id}`}
          type="button"
          onClick={() => {
            closeDetail()
            onOpenChat()
          }}
          className="guest-btn guest-btn-ghost flex w-full items-center justify-center gap-2 py-2.5 text-sm font-medium"
        >
          <MessageCircle className="h-4 w-4" />
          Message staff
        </button>
      )}

      {canApprove && (
        <div id={`guest-approve-${complaint.id}`} className="space-y-2 guest-divider pt-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--brand-gold-dark)]" />
            <p className="text-sm font-medium">Confirm work is complete</p>
          </div>
          <p className="text-xs guest-text-muted">
            Our technician has finished. Tap below once you are satisfied with the repair.
          </p>
          {approveError && <p className="text-sm text-red-600">{approveError}</p>}
          <button
            type="button"
            onClick={handleApprove}
            disabled={approveLoading}
            className="guest-btn guest-btn-accent w-full py-3 text-sm disabled:opacity-50"
          >
            {approveLoading ? 'Confirming…' : 'Yes, work is complete'}
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      <li id={`guest-issue-${complaint.id}`} className="guest-complaint-card">
        <button
          type="button"
          onClick={openDetail}
          className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--guest-accent-softer)]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium capitalize">{complaint.category}</p>
              <span className="rounded-md bg-[var(--guest-accent-soft)] px-2 py-0.5 font-mono text-[10px] guest-text-muted">
                {guestComplaintReference(complaint.id)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--brand-gold-dark)]">
              {guestStatusLabel(complaint.status, complaint.approval_stage)}
            </p>
            {complaint.description && (
              <p className="mt-1 line-clamp-2 text-sm guest-text-muted">{complaint.description}</p>
            )}
          </div>
          <span className="shrink-0 text-xs font-medium text-[var(--brand-purple)]">Details</span>
        </button>
      </li>

      {mounted &&
        detailOpen &&
        createPortal(
          <div
            className="guest-issue-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${complaint.category} issue details`}
          >
            <button
              type="button"
              className="guest-issue-modal__backdrop"
              aria-label="Close issue details"
              onClick={closeDetail}
            />
            <div className="guest-issue-modal__panel">
              <header className="guest-issue-modal__header">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold capitalize">{complaint.category}</p>
                    <span className="rounded-md bg-[var(--guest-accent-soft)] px-2 py-0.5 font-mono text-[10px] guest-text-muted">
                      {guestComplaintReference(complaint.id)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--brand-gold-dark)]">
                    {guestStatusLabel(complaint.status, complaint.approval_stage)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  aria-label="Close"
                  className="guest-issue-modal__close"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              {complaint.description && (
                <p className="guest-issue-modal__description guest-text-muted">
                  {complaint.description}
                </p>
              )}

              <div ref={bodyRef} className="guest-issue-modal__body">
                <div className="flex flex-col gap-4">{detailContent}</div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

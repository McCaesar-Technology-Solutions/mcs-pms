'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, MessageCircle } from 'lucide-react'
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
  defaultExpanded?: boolean
  forceExpanded?: boolean
  focusSection?: GuestNextActionFocus | null
  onFocusHandled?: () => void
  onNextStep?: (complaintId: string, focus: GuestNextActionFocus) => void
}

export function GuestComplaintCard({
  complaint,
  onUpdated,
  onOpenChat,
  defaultExpanded = false,
  forceExpanded = false,
  focusSection = null,
  onFocusHandled,
  onNextStep,
}: GuestComplaintCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || forceExpanded)
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)
  const [activity, setActivity] = useState<{ id: string; label: string; createdAt: string }[]>([])

  const canApprove = canGuestApproveCompletion(complaint)
  const nextAction = getGuestNextAction(complaint)
  const awaitingVisit =
    !complaint.scheduled_visit_at &&
    ['open', 'assigned', 'in_progress', 'rejected'].includes(complaint.status ?? '')

  const loadActivity = useCallback(async () => {
    const result = await getGuestComplaintActivity(complaint.id)
    if (result.success && result.data) setActivity(result.data.events)
  }, [complaint.id])

  useEffect(() => {
    if (expanded) void loadActivity()
  }, [expanded, loadActivity])

  useEffect(() => {
    if (forceExpanded) setExpanded(true)
  }, [forceExpanded])

  useEffect(() => {
    if (!focusSection || !expanded) return
    const targetId =
      focusSection === 'approve'
        ? `guest-approve-${complaint.id}`
        : focusSection === 'chat'
          ? `guest-chat-${complaint.id}`
          : `guest-issue-${complaint.id}`
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      onFocusHandled?.()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [focusSection, expanded, complaint.id, onFocusHandled])

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

  return (
    <li
      id={`guest-issue-${complaint.id}`}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07]"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium capitalize text-white">{complaint.category}</p>
            <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/60">
              {guestComplaintReference(complaint.id)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[#D4A62E]">
            {guestStatusLabel(complaint.status, complaint.approval_stage)}
          </p>
          {complaint.description && (
            <p className="mt-1 line-clamp-2 text-sm text-white/60">{complaint.description}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-white/40">{expanded ? 'Hide' : 'Details'}</span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4">
          {nextAction && (
            <div className="mt-3">
              <GuestNextStepBanner
                action={nextAction}
                variant="inline"
                onAction={(action) => {
                  if (action.focus === 'chat') {
                    onOpenChat?.()
                    return
                  }
                  onNextStep?.(complaint.id, action.focus)
                }}
              />
            </div>
          )}

          <GuestComplaintProgress complaint={complaint} />

          {(complaint.scheduled_visit_at || awaitingVisit) && (
            <div className="mt-3 rounded-xl bg-white/5 px-3 py-3">
              <ScheduledVisitDisplay
                scheduledVisitAt={complaint.scheduled_visit_at}
                variant="dark"
                pendingMessage={
                  awaitingVisit
                    ? 'Your technician will call you to agree a visit time.'
                    : undefined
                }
              />
            </div>
          )}

          {activity.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                Recent updates
              </p>
              <ul className="mt-2 space-y-2">
                {activity.slice(-4).map((ev) => (
                  <li key={ev.id} className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-white/75">{ev.label}</span>
                    <span className="shrink-0 text-white/40">
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
              onClick={onOpenChat}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-medium text-white/80"
            >
              <MessageCircle className="h-4 w-4" />
              Message staff
            </button>
          )}

          {canApprove && (
            <div
              id={`guest-approve-${complaint.id}`}
              className="mt-4 space-y-2 border-t border-white/10 pt-4"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#D4A62E]" />
                <p className="text-sm font-medium text-white">Confirm work is complete</p>
              </div>
              <p className="text-xs text-white/70">
                Our technician has finished. Tap below once you are satisfied with the repair.
              </p>
              {approveError && <p className="text-sm text-red-200">{approveError}</p>}
              <button
                type="button"
                onClick={handleApprove}
                disabled={approveLoading}
                className="w-full rounded-xl bg-[#D85A30] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {approveLoading ? 'Confirming…' : 'Yes, work is complete'}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

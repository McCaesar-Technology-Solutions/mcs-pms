'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarClock, MessageCircle } from 'lucide-react'
import { scheduleTechnicianComplaintVisit } from '@/app/actions/complaints'
import { StaffComplaintMessageThread } from '@/components/complaints/staff-complaint-message-thread'
import { ComplaintEstimateCard } from '@/components/complaints/complaint-estimate-card'
import { ScheduleVisitForm } from '@/components/complaints/schedule-visit-form'
import { OptionalInvoicePanel } from '@/components/technician/optional-invoice-panel'
import { TechnicianComplaintPhoto } from '@/components/technician/technician-complaint-photo'
import { TechnicianJobProgress } from '@/components/technician/technician-job-progress'
import { TechnicianNextStepBanner } from '@/components/technician/technician-next-step-banner'
import { PhoneContact } from '@/components/ui/phone-contact'
import { guestComplaintReference } from '@/lib/complaints/guest-progress'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'
import { getTechnicianNextAction, technicianScrollTarget } from '@/lib/complaints/technician-progress'
import type { TechnicianNextAction } from '@/lib/complaints/technician-progress'
import {
  canMarkComplete,
  canStartJob,
  canSubmitInvoice,
  canTechnicianScheduleVisit,
  isPendingCompletion,
  technicianStatusLabel,
} from '@/lib/complaints/workflow'
import { formatComplaintVisit } from '@/lib/complaints/visit'
import type { Complaint, ComplaintCategory, ComplaintEstimate } from '@/types'
import type { LucideIcon } from 'lucide-react'

const TECHNICIAN_QUICK_REPLIES = [
  "Hi, I'm your technician. When is a good time to visit your room?",
  "I'm on my way to your room now.",
  "I've started working on your issue.",
  'Please confirm in your guest portal when the repair looks good to you.',
] as const

type DetailTab = 'overview' | 'messages'

interface TechnicianJobDetailProps {
  complaint: Complaint
  estimate: ComplaintEstimate | null | undefined
  loading: boolean
  categoryIcon: LucideIcon
  roomLabel: string
  priorityClass: string
  statusClass: string
  initialTab?: DetailTab
  focusTarget?: string | null
  onClose: () => void
  onReload: () => void
  onReloadEstimate: () => void
  onNextAction: (action: TechnicianNextAction) => void
  onStart: () => void
  onComplete: () => void
}

export function TechnicianJobDetail({
  complaint: c,
  estimate,
  loading,
  categoryIcon: Icon,
  roomLabel,
  priorityClass,
  statusClass,
  initialTab = 'overview',
  focusTarget = null,
  onClose,
  onReload,
  onReloadEstimate,
  onNextAction,
  onStart,
  onComplete,
}: TechnicianJobDetailProps) {
  const [tab, setTab] = useState<DetailTab>(initialTab)
  const nextAction = getTechnicianNextAction(c)

  const showChat = c.status !== 'resolved' && Boolean(c.guest_id ?? c.guests?.phone)
  const showGuestContact =
    Boolean(c.guests?.phone) &&
    c.status !== 'resolved' &&
    (nextAction?.type === 'contact_guest' ||
      nextAction?.type === 'schedule_visit' ||
      nextAction?.type === 'start_job' ||
      nextAction?.type === 'mark_complete' ||
      nextAction?.type === 'rework')

  const footerAction = useMemo(() => {
    if (nextAction?.actionKind === 'start') {
      return { label: nextAction.actionLabel, onClick: onStart, variant: 'accent' as const }
    }
    if (nextAction?.actionKind === 'complete') {
      return { label: nextAction.actionLabel, onClick: onComplete, variant: 'primary' as const }
    }
    if (canMarkComplete(c)) {
      return { label: 'Request sign-off', onClick: onComplete, variant: 'primary' as const }
    }
    if (canStartJob(c) && c.status === 'assigned') {
      return { label: 'Mark as started', onClick: onStart, variant: 'accent' as const }
    }
    return null
  }, [c, nextAction, onStart, onComplete])

  useEffect(() => {
    setTab(initialTab)
  }, [c.id, initialTab])

  useEffect(() => {
    if (!focusTarget) return
    const timer = window.setTimeout(() => {
      document.getElementById(focusTarget)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [focusTarget, tab])

  return (
    <div className="technician-job-screen" role="dialog" aria-modal="true" aria-label={`Job room ${roomLabel}`}>
      <header className="technician-job-screen__header">
        <button type="button" onClick={onClose} className="technician-job-screen__back" aria-label="Back to jobs">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="technician-job-card__icon h-9 w-9 shrink-0">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">Room {roomLabel}</p>
              <p className="truncate text-xs capitalize text-[var(--tech-fg-muted)]">
                {c.category} · {guestComplaintReference(c.id)}
              </p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`technician-pill ${priorityClass}`}>{c.priority ?? 'medium'}</span>
            <span className={`technician-pill ${statusClass}`}>{technicianStatusLabel(c)}</span>
          </div>
        </div>
      </header>

      {showChat && (
        <div className="technician-job-screen__tabs" role="tablist" aria-label="Job sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'overview'}
            onClick={() => setTab('overview')}
            className={`technician-job-screen__tab ${tab === 'overview' ? 'technician-job-screen__tab--active' : ''}`}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'messages'}
            onClick={() => setTab('messages')}
            className={`technician-job-screen__tab ${tab === 'messages' ? 'technician-job-screen__tab--active' : ''}`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Messages
          </button>
        </div>
      )}

      <div className="technician-job-screen__body">
        {tab === 'overview' && (
          <div className="technician-job-screen__overview">
            {c.description && (
              <p className="text-sm leading-relaxed text-[var(--tech-fg-muted)]">{c.description}</p>
            )}

            {nextAction && (
              <TechnicianNextStepBanner
                action={nextAction}
                loading={loading}
                compact
                onAction={() => onNextAction(nextAction)}
              />
            )}

            <TechnicianComplaintPhoto complaintId={c.id} hasPhoto={Boolean(c.guest_photo_path)} />

            <div className="technician-detail-card">
              <TechnicianJobProgress complaint={c} />
            </div>

            {showGuestContact && c.guests?.phone && (
              <div id={technicianScrollTarget(c.id, 'contact')} className="technician-detail-card">
                <PhoneContact
                  name={c.guests.name ?? 'Guest'}
                  phone={c.guests.phone}
                  label={`Guest${c.guests.name ? ` · ${c.guests.name}` : ''}`}
                />
              </div>
            )}

            {canTechnicianScheduleVisit(c) && (
              <div id={technicianScrollTarget(c.id, 'visit')} className="technician-detail-card">
                <ScheduleVisitForm
                  complaintId={c.id}
                  scheduledVisitAt={c.scheduled_visit_at}
                  onSchedule={scheduleTechnicianComplaintVisit}
                  onSuccess={onReload}
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
                  <p className="mt-1 text-sm font-medium">{formatComplaintVisit(c.scheduled_visit_at)}</p>
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

            {canSubmitInvoice(c) && (
              <OptionalInvoicePanel
                complaintId={c.id}
                roomNumber={c.rooms?.number ?? c.room?.number ?? null}
                category={c.category}
                onSubmitted={() => {
                  onReloadEstimate()
                  onReload()
                }}
              />
            )}

            {estimate &&
              (c.status === 'assigned' || c.status === 'in_progress' || isPendingCompletion(c)) && (
                <ComplaintEstimateCard estimate={estimate} />
              )}

            {c.status === 'resolved' && c.resolved_at && (
              <p className="text-center text-xs text-[var(--tech-fg-muted)]">
                Resolved {new Date(c.resolved_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {tab === 'messages' && showChat && (
          <div id={technicianScrollTarget(c.id, 'chat')} className="technician-job-screen__chat">
            <StaffComplaintMessageThread
              complaintId={c.id}
              guestName={c.guests?.name}
              guestAvatarUrl={profilePhotoPublicUrl(c.guests?.profile_image_path)}
              roomNumber={roomLabel}
              complaintCategory={c.category as ComplaintCategory}
              quickReplies={TECHNICIAN_QUICK_REPLIES}
              compact
              messagePlaceholder="Message guest…"
            />
          </div>
        )}
      </div>

      {footerAction && tab === 'overview' && (
        <footer className="technician-job-screen__footer">
          <button
            type="button"
            disabled={loading}
            onClick={footerAction.onClick}
            className={`technician-btn technician-btn--${footerAction.variant} w-full py-3`}
          >
            {loading ? 'Working…' : footerAction.label}
          </button>
        </footer>
      )}
    </div>
  )
}

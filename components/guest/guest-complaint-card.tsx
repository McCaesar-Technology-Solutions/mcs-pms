'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { approveGuestComplaintCompletion } from '@/app/actions/guest'
import { ScheduledVisitDisplay } from '@/components/complaints/schedule-visit-form'
import { guestStatusLabel } from '@/components/complaints/complaints-overview'
import { canGuestApproveCompletion } from '@/lib/complaints/workflow'
import type { Complaint } from '@/types'

interface GuestComplaintCardProps {
  complaint: Complaint
  onUpdated: () => void
}

export function GuestComplaintCard({ complaint, onUpdated }: GuestComplaintCardProps) {
  const [approveLoading, setApproveLoading] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const canApprove = canGuestApproveCompletion(complaint)
  const awaitingVisit =
    !complaint.scheduled_visit_at &&
    ['open', 'assigned', 'in_progress', 'rejected'].includes(complaint.status ?? '')

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
  }

  return (
    <li className="rounded-xl bg-white/10 px-4 py-3">
      <p className="capitalize">{complaint.category}</p>
      <p className="text-sm text-[#D4A62E]">
        {guestStatusLabel(complaint.status, complaint.approval_stage)}
      </p>
      {complaint.description && (
        <p className="mt-1 text-sm text-white/70 line-clamp-2">{complaint.description}</p>
      )}

      {(complaint.scheduled_visit_at || awaitingVisit) && (
        <div className="mt-3 border-t border-white/10 pt-3">
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

      {canApprove && (
        <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
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
    </li>
  )
}

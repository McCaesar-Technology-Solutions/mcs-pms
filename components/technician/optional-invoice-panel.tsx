'use client'

import { ComplaintEstimateForm } from '@/components/technician/complaint-estimate-form'

interface OptionalInvoicePanelProps {
  complaintId: string
  roomNumber?: string | null
  category?: string | null
  defaultOpen?: boolean
  onSubmitted?: () => void
}

/** Collapsible invoice section — optional, never required to complete a job. */
export function OptionalInvoicePanel({
  complaintId,
  roomNumber,
  category,
  defaultOpen = false,
  onSubmitted,
}: OptionalInvoicePanelProps) {
  return (
    <details
      className="technician-detail-card group open:shadow-[var(--tech-shadow)]"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-1 py-1 text-sm font-semibold text-[var(--brand-purple)] marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          Optional: send invoice to manager
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">
            Tap to expand
          </span>
        </span>
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          Upload a file or enter costs — not required to finish the job.
        </p>
      </summary>
      <div className="border-t border-[#E9ECEF] p-3 pt-0">
        <ComplaintEstimateForm
          complaintId={complaintId}
          roomNumber={roomNumber}
          category={category}
          onSubmitted={onSubmitted}
        />
      </div>
    </details>
  )
}

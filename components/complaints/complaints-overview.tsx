'use client'

import Link from 'next/link'
import {
  Droplets,
  Zap,
  Wind,
  Armchair,
  Sparkles,
  Volume2,
  HelpCircle,
  ArrowRight,
  ChevronRight,
} from 'lucide-react'
import type { Complaint, ComplaintCategory, ComplaintStatus } from '@/types'

const categoryIcons: Record<ComplaintCategory, typeof Droplets> = {
  plumbing: Droplets,
  electrical: Zap,
  hvac: Wind,
  furniture: Armchair,
  cleaning: Sparkles,
  noise: Volume2,
  other: HelpCircle,
}

const statusLabels: Record<ComplaintStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  pending_approval: 'Pending approval',
  rejected: 'Rejected',
  resolved: 'Resolved',
}

const priorityAccent: Record<string, string> = {
  urgent: 'shadow-[inset_4px_0_0_0_#D85A30]',
  high: 'shadow-[inset_4px_0_0_0_#f97316]',
  medium: 'shadow-[inset_4px_0_0_0_#D4A62E]',
  low: 'shadow-[inset_4px_0_0_0_#cbd5e1]',
}

function overviewRoomNumber(c: Complaint): string | null {
  return c.rooms?.number ?? c.room?.number ?? null
}

function overviewGuestName(c: Complaint): string | null {
  return c.guests?.name ?? c.guest?.name ?? null
}

function guestStatusLabel(
  status: ComplaintStatus | null,
  approvalStage?: Complaint['approval_stage'],
): string {
  if (!status) return 'Submitted'
  if (status === 'pending_approval' && approvalStage === 'estimate') return 'Being handled'
  if (status === 'pending_approval') return 'Please confirm work is complete'
  if (['open', 'assigned', 'in_progress'].includes(status)) return 'Being handled'
  if (status === 'resolved') return 'Resolved ✓'
  if (status === 'rejected') return 'Being reviewed again'
  return status
}

function statusBadge(status: ComplaintStatus | null | undefined) {
  switch (status) {
    case 'pending_approval':
      return 'bg-[#D85A30]/12 text-[#D85A30]'
    case 'open':
      return 'bg-[#3C216C]/10 text-[#3C216C]'
    case 'assigned':
    case 'in_progress':
      return 'bg-[#D4A62E]/15 text-[#B88D24]'
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-700'
    case 'rejected':
      return 'bg-red-500/10 text-red-700'
    default:
      return 'bg-[#E9ECEF]/80 text-[#5E5872]'
  }
}

interface ComplaintsOverviewProps {
  complaints: Complaint[]
  limit?: number
  /** Where the cards and "view all" link point (role-scoped complaints page). */
  complaintsHref?: string
}

export function ComplaintsOverview({
  complaints,
  limit = 5,
  complaintsHref = '/manager/complaints',
}: ComplaintsOverviewProps) {
  const active = complaints.filter((c) => c.status !== 'resolved').slice(0, limit)
  const pendingCount = active.filter((c) => c.status === 'pending_approval').length

  if (active.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-elevation-1">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3C216C]/8">
          <Sparkles className="h-5 w-5 text-[#3C216C]" />
        </div>
        <p className="text-sm text-muted-foreground">No active complaints right now.</p>
        <Link
          href={complaintsHref}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#3C216C] hover:underline"
        >
          Open complaints board
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#D85A30]/10 to-transparent px-4 py-2.5 shadow-elevation-1">
          <span className="flex h-2 w-2 rounded-full bg-[#D85A30]" />
          <p className="text-sm font-medium text-[#D85A30]">
            {pendingCount} awaiting your approval
          </p>
        </div>
      )}

      <div className="space-y-2">
        {active.map((c) => {
          const Icon = categoryIcons[c.category]
          const isPending = c.status === 'pending_approval'

          return (
            <Link
              key={c.id}
              href={complaintsHref}
              className={`group flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2 ${
                priorityAccent[c.priority ?? 'medium']
              } ${isPending ? 'ring-2 ring-[#D85A30]/15' : ''}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isPending ? 'bg-[#D85A30]/12' : 'bg-[#3C216C]/6'
                }`}
              >
                <Icon className={`h-5 w-5 ${isPending ? 'text-[#D85A30]' : 'text-[#3C216C]'}`} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <p className="font-semibold capitalize text-foreground">{c.category}</p>
                  {overviewRoomNumber(c) && (
                    <span className="rounded-md bg-[#3C216C]/8 px-1.5 py-0.5 text-[10px] font-semibold text-[#3C216C]">
                      Room {overviewRoomNumber(c)}
                    </span>
                  )}
                  {overviewGuestName(c) && (
                    <span className="text-xs text-muted-foreground">{overviewGuestName(c)}</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {c.description.length > 48 ? `${c.description.slice(0, 48)}…` : c.description}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c.status)}`}
                >
                  {statusLabels[c.status ?? 'open']}
                </span>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[#3C216C]" />
            </Link>
          )
        })}
      </div>

      <Link
        href={complaintsHref}
        className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-[#3C216C] shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2"
      >
        View all complaints
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

export { guestStatusLabel }

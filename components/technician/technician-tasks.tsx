'use client'

import { useCallback, useEffect, useState } from 'react'
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
} from 'lucide-react'
import { getTechnicianComplaints, updateTechnicianComplaintStatus } from '@/app/actions/complaints'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import type { Complaint, ComplaintCategory, ComplaintStatus } from '@/types'

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

const statusLabels: Record<ComplaintStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  pending_approval: 'Pending approval',
  rejected: 'Sent back',
  resolved: 'Resolved',
}

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

function statusBadge(status: ComplaintStatus | null | undefined) {
  switch (status) {
    case 'pending_approval':
      return 'bg-[#D85A30]/12 text-[#D85A30]'
    case 'assigned':
    case 'in_progress':
      return 'bg-[#D4A62E]/15 text-[#B88D24]'
    case 'resolved':
      return 'bg-emerald-500/10 text-emerald-700'
    case 'rejected':
      return 'bg-red-500/10 text-red-700'
    default:
      return 'bg-[#3C216C]/10 text-[#3C216C]'
  }
}

export function TechnicianTasks() {
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

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

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh('complaints', load)

  async function updateStatus(id: string, status: 'in_progress' | 'pending_approval') {
    setLoading(id)
    await updateTechnicianComplaintStatus(id, status)
    setLoading(null)
    await load()
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-8 pt-4">
      <div className="mb-5 flex rounded-2xl bg-white p-1 shadow-elevation-1">
        {(['active', 'completed'] as const).map((t) => (
          <button
            key={t}
            type="button"
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

      <div className="space-y-3">
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
          const isPending = c.status === 'pending_approval'

          return (
            <article
              key={c.id}
              className={`overflow-hidden rounded-2xl bg-white shadow-elevation-1 transition-all ${
                expanded ? 'shadow-elevation-2' : 'hover:-translate-y-px hover:shadow-elevation-2'
              } ${isRejected ? 'ring-2 ring-red-500/10' : ''} ${isPending ? 'ring-2 ring-[#D85A30]/10' : ''}`}
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left"
                onClick={() => setExpandedId(expanded ? null : c.id)}
              >
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
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c.status)}`}
                  >
                    {statusLabels[c.status ?? 'assigned']}
                  </span>
                </div>

                <span className="mt-1 shrink-0 text-muted-foreground">
                  {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </span>
              </button>

              {expanded && (
                <div className="mx-4 mb-4 space-y-3 rounded-xl bg-[#F7F4FB] p-4">
                  <p className="text-sm leading-relaxed text-foreground">{c.description}</p>

                  {c.rejection_note && (
                    <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700 shadow-elevation-1">
                      <p className="font-semibold">Manager note</p>
                      <p className="mt-1">{c.rejection_note}</p>
                    </div>
                  )}

                  {c.status === 'assigned' && (
                    <button
                      type="button"
                      disabled={loading === c.id}
                      onClick={() => updateStatus(c.id, 'in_progress')}
                      className="w-full rounded-xl bg-[#D4A62E] py-3 text-sm font-semibold text-gray-900 shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-60"
                    >
                      Start job
                    </button>
                  )}
                  {c.status === 'in_progress' && (
                    <button
                      type="button"
                      disabled={loading === c.id}
                      onClick={() => updateStatus(c.id, 'pending_approval')}
                      className="w-full rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-60"
                    >
                      Mark complete
                    </button>
                  )}
                  {c.status === 'rejected' && (
                    <button
                      type="button"
                      disabled={loading === c.id}
                      onClick={() => updateStatus(c.id, 'in_progress')}
                      className="w-full rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1 transition-all hover:shadow-elevation-2 disabled:opacity-60"
                    >
                      Resume job
                    </button>
                  )}
                  {c.status === 'pending_approval' && (
                    <p className="rounded-xl bg-white px-3 py-2.5 text-center text-sm font-medium text-muted-foreground shadow-elevation-1">
                      Awaiting manager approval
                    </p>
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

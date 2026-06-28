'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Droplets,
  Zap,
  Wind,
  Armchair,
  Sparkles,
  Volume2,
  HelpCircle,
  X,
  Phone,
} from 'lucide-react'
import { Plus } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { getComplaintEvents, getHotelComplaints } from '@/app/actions/complaints'
import { fetchComplaintEstimate } from '@/app/actions/complaint-estimates'
import { ComplaintEstimateCard } from '@/components/complaints/complaint-estimate-card'
import { StaffComplaintModal } from '@/components/complaints/staff-complaint-modal'
import { StaffComplaintMessageThread } from '@/components/complaints/staff-complaint-message-thread'
import { ComplaintsBulkBar } from '@/components/complaints/complaints-bulk-bar'
import { ComplaintsSelectableList } from '@/components/complaints/complaints-selectable-list'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { useRowSelection } from '@/lib/hooks/use-row-selection'
import { PhoneContact } from '@/components/ui/phone-contact'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import { managerPendingLabel } from '@/lib/complaints/workflow'
import { profilePhotoPublicUrl } from '@/lib/profile-photos/storage'
import type {
  Complaint,
  ComplaintCategory,
  ComplaintEstimate,
  ComplaintEvent,
  ComplaintEventType,
  ComplaintStatus,
} from '@/types'

const categoryIcons: Record<ComplaintCategory, typeof Droplets> = {
  plumbing: Droplets,
  electrical: Zap,
  hvac: Wind,
  furniture: Armchair,
  cleaning: Sparkles,
  noise: Volume2,
  other: HelpCircle,
}

const priorityAccent: Record<string, string> = {
  urgent: 'shadow-[inset_4px_0_0_0_#D85A30]',
  high: 'shadow-[inset_4px_0_0_0_#f97316]',
  medium: 'shadow-[inset_4px_0_0_0_#D4A62E]',
  low: 'shadow-[inset_4px_0_0_0_#cbd5e1]',
}

const staffPanelInset = 'staff-panel-inset'

const timelineLabels: Record<ComplaintEventType, string> = {
  submitted: 'Submitted',
  assigned: 'Assigned to technician',
  started: 'Work started',
  completion_requested: 'Work marked complete',
  rejected: 'Sent back for rework',
  resolved: 'Resolved',
  estimate_submitted: 'Invoice submitted',
  estimate_approved: 'Invoice approved — work authorized',
  visit_scheduled: 'Visit scheduled',
  guest_completion_approved: 'Guest confirmed completion',
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function roomNumberOf(c: Complaint): string | null {
  return c.rooms?.number ?? c.room?.number ?? null
}

function guestNameOf(c: Complaint): string | null {
  return c.guests?.name ?? c.guest?.name ?? null
}

function guestAvatarUrlOf(c: Complaint): string | null {
  return profilePhotoPublicUrl(c.guests?.profile_image_path ?? c.guest?.profile_image_path)
}

function guestPhoneOf(c: Complaint): string | null {
  return c.guests?.phone ?? c.guest?.phone ?? null
}

function priorityBadge(priority: string | null | undefined) {
  switch (priority) {
    case 'urgent':
      return 'bg-[#D85A30] text-white'
    case 'high':
      return 'bg-orange-100 text-orange-800'
    case 'medium':
      return 'bg-[#D4A62E]/20 text-[#B88D24]'
    default:
      return 'bg-[#E9ECEF] text-[#5E5872]'
  }
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
      return 'bg-emerald-50 text-emerald-700'
    case 'rejected':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-[#E9ECEF] text-[#5E5872]'
  }
}

interface ComplaintsOwnerViewProps {
  /** Show a "Log complaint" button (front-desk roles). Owners stay read-only. */
  canLog?: boolean
  /** Allow messaging guests on open complaints (receptionist / front desk). */
  canMessage?: boolean
}

/** Read-only complaints view: full lifecycle visibility, no assign/approve actions. */
export function ComplaintsOwnerView({ canLog = false, canMessage = false }: ComplaintsOwnerViewProps) {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [events, setEvents] = useState<ComplaintEvent[]>([])
  const [estimate, setEstimate] = useState<ComplaintEstimate | null>(null)
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const selectedRef = useRef<Complaint | null>(null)
  selectedRef.current = selected

  const load = useCallback(async () => {
    const result = await getHotelComplaints()
    if (result.success && result.data) setComplaints(result.data)
  }, [])

  const refreshFromRealtime = useCallback(async () => {
    const result = await getHotelComplaints()
    if (!result.success || !result.data) return
    setComplaints(result.data)
    const current = selectedRef.current
    if (current) {
      const updated = result.data.find((c) => c.id === current.id)
      if (updated) {
        setSelected(updated)
        const [evResult, estResult] = await Promise.all([
          getComplaintEvents(updated.id),
          fetchComplaintEstimate(updated.id),
        ])
        if (evResult.success && evResult.data) setEvents(evResult.data)
        if (estResult.success) setEstimate(estResult.data ?? null)
      }
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh('complaints', refreshFromRealtime)
  useRealtimeRefresh('layout', refreshFromRealtime)

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return complaints
    return complaints.filter((c) => c.status === statusFilter)
  }, [complaints, statusFilter])

  const selection = useRowSelection(complaints, filtered)

  async function openDetail(complaint: Complaint) {
    setSelected(complaint)
    setEstimate(null)
    setEvents([])
    const [evResult, estResult] = await Promise.all([
      getComplaintEvents(complaint.id),
      fetchComplaintEstimate(complaint.id),
    ])
    if (evResult.success && evResult.data) setEvents(evResult.data)
    if (estResult.success) setEstimate(estResult.data ?? null)
  }

  function closeDetail() {
    setSelected(null)
    setEstimate(null)
    setEvents([])
  }

  const SelectedIcon = selected ? categoryIcons[selected.category] : HelpCircle

  return (
    <div className="space-y-6">
      <ComplaintsBulkBar
        selected={selection.selected}
        onClear={selection.clear}
        roomNumberOf={roomNumberOf}
        guestNameOf={guestNameOf}
      />
      {canLog && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="gradient-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-elevation-2 transition-all hover:-translate-y-0.5 hover:shadow-elevation-3"
            >
              <Plus className="h-4 w-4" />
              Log complaint
            </button>
          </div>
          <StaffComplaintModal
            open={showCreate}
            onClose={() => setShowCreate(false)}
            onCreated={load}
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'open', 'assigned', 'in_progress', 'pending_approval', 'resolved'] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={`filter-pill filter-pill--sm ${statusFilter === s ? 'filter-pill--active' : ''}`}
            >
              {s.replace('_', ' ')}
            </button>
          ),
        )}
        {filtered.length > 0 && (
          <label className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <BulkSelectCheckbox
              checked={selection.allFilteredSelected}
              onChange={selection.toggleAllFiltered}
              aria-label="Select all visible complaints"
            />
            Select all
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <DataEmptyState borderless title="No matches" message="No complaints match this filter." />
      ) : (
        <ComplaintsSelectableList
          complaints={filtered}
          categoryIcons={categoryIcons}
          isSelected={selection.isSelected}
          onToggle={selection.toggle}
          onOpen={openDetail}
          roomNumberOf={roomNumberOf}
          guestNameOf={guestNameOf}
          statusBadge={statusBadge}
        />
      )}

      <Sheet open={!!selected} onOpenChange={(open) => !open && closeDetail()} aria-label="Complaint details">
        {selected && (
          <>
            <div className="gradient-primary shrink-0 px-6 pb-6 pt-5 text-white shadow-elevation-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-elevation-1 backdrop-blur-sm">
                    <SelectedIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-white/55">
                      Complaint
                    </p>
                    <h2 className="mt-0.5 font-display text-2xl font-semibold capitalize">
                      {selected.category}
                    </h2>
                    {(roomNumberOf(selected) || guestNameOf(selected)) && (
                      <p className="mt-1 text-sm text-white/80">
                        {roomNumberOf(selected) ? `Room ${roomNumberOf(selected)}` : ''}
                        {roomNumberOf(selected) && guestNameOf(selected) ? ' · ' : ''}
                        {guestNameOf(selected) ?? ''}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  aria-label="Close"
                  className="rounded-xl p-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${priorityBadge(selected.priority)}`}>
                  {formatLabel(selected.priority ?? 'medium')} priority
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${statusBadge(selected.status)}`}>
                  {selected.status === 'pending_approval'
                    ? managerPendingLabel(selected)
                    : formatLabel(selected.status ?? 'open')}
                </span>
              </div>
            </div>

            <SheetContent className="space-y-4">
              <div className={`${staffPanelInset} p-4`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Description
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{selected.description}</p>
              </div>

              {canMessage && selected.guest_id && selected.status !== 'resolved' && (
                <StaffComplaintMessageThread
                  complaintId={selected.id}
                  guestName={guestNameOf(selected)}
                  guestAvatarUrl={guestAvatarUrlOf(selected)}
                  roomNumber={roomNumberOf(selected)}
                  complaintCategory={selected.category}
                />
              )}

              {!canLog && !canMessage && selected.status !== 'resolved' && (
                <div className="rounded-2xl border border-[#3C216C]/10 bg-[#3C216C]/5 p-4 text-sm text-muted-foreground">
                  Need something done on this issue? Contact your manager to assign a technician or
                  message the guest.
                </div>
              )}

              {(guestPhoneOf(selected) || selected.assignee?.phone) && (
                <div className={`${staffPanelInset} space-y-3 p-4`}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#3C216C]">
                    <Phone className="h-4 w-4" />
                    Contact
                  </p>
                  {guestPhoneOf(selected) && guestNameOf(selected) && (
                    <PhoneContact
                      name={guestNameOf(selected)!}
                      phone={guestPhoneOf(selected)!}
                      label={`Guest · ${guestNameOf(selected)}`}
                    />
                  )}
                  {selected.assignee?.phone && (
                    <PhoneContact
                      name={selected.assignee.name}
                      phone={selected.assignee.phone}
                      label={`Technician · ${selected.assignee.name}`}
                    />
                  )}
                </div>
              )}

              {selected.rejection_note && (
                <div className="rounded-2xl bg-red-500/8 p-4 shadow-elevation-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-600/90">
                    Manager note
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-red-800/90">{selected.rejection_note}</p>
                </div>
              )}

              {estimate && <ComplaintEstimateCard estimate={estimate} />}

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Lifecycle
                </p>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events recorded yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {events.map((ev, index) => (
                      <li key={ev.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-[#D4A62E] shadow-elevation-1" />
                          {index < events.length - 1 && (
                            <span className="mt-1 w-px flex-1 min-h-6 bg-gradient-to-b from-[#D4A62E]/35 to-transparent" />
                          )}
                        </div>
                        <div className={`${staffPanelInset} mb-1 flex-1 px-4 py-3`}>
                          <p className="text-sm font-semibold text-foreground">
                            {timelineLabels[ev.event_type] ?? formatLabel(ev.event_type)}
                          </p>
                          {ev.note && (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{ev.note}</p>
                          )}
                          {ev.created_at && (
                            <p className="mt-2 text-[10px] font-medium text-muted-foreground/80">
                              {new Date(ev.created_at).toLocaleString('en-GH', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </SheetContent>
          </>
        )}
      </Sheet>
    </div>
  )
}

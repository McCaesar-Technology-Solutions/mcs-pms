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
  CheckCircle2,
  UserPlus,
  Clock,
  Receipt,
  Phone,
  Plus,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  approveComplaint,
  assignComplaint,
  getComplaintEvents,
  getHotelComplaints,
  getTechnicians,
  rejectComplaint,
} from '@/app/actions/complaints'
import { fetchComplaintEstimate } from '@/app/actions/complaint-estimates'
import { ComplaintEstimateCard } from '@/components/complaints/complaint-estimate-card'
import { ScheduledVisitDisplay } from '@/components/complaints/schedule-visit-form'
import { StaffComplaintModal } from '@/components/complaints/staff-complaint-modal'
import { StaffComplaintMessageThread } from '@/components/complaints/staff-complaint-message-thread'
import { getStaffComplaintPhotoUrl } from '@/app/actions/guest-portal-staff'
import { PhoneContact } from '@/components/ui/phone-contact'
import { useRealtimeRefresh } from '@/components/realtime/realtime-refresh-context'
import {
  isPendingCompletion,
  isPendingEstimate,
  managerPendingLabel,
  needsGuestCompletionApproval,
  canManagerApproveCompletion,
} from '@/lib/complaints/workflow'
import type {
  Complaint,
  ComplaintCategory,
  ComplaintEstimate,
  ComplaintEvent,
  ComplaintEventType,
  ComplaintStatus,
  DbRoomStatus,
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

const softField =
  'mt-2 w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 text-sm text-foreground shadow-elevation-1 outline-none transition-[box-shadow,transform] focus:shadow-elevation-2 focus:ring-2 focus:ring-[#3C216C]/10'

const liftCard = 'rounded-2xl bg-white shadow-elevation-1'

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function roomNumberOf(c: Complaint): string | null {
  return c.rooms?.number ?? c.room?.number ?? null
}

function guestNameOf(c: Complaint): string | null {
  return c.guests?.name ?? c.guest?.name ?? null
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

const timelineLabels: Record<ComplaintEventType, string> = {
  submitted: 'Submitted by guest',
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

export function ComplaintsManager() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [technicians, setTechnicians] = useState<
    { id: string; name: string; specialty: string | null; phone: string | null }[]
  >([])
  const [selected, setSelected] = useState<Complaint | null>(null)
  const [events, setEvents] = useState<ComplaintEvent[]>([])
  const [estimate, setEstimate] = useState<ComplaintEstimate | null>(null)
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all')
  const [rejectNote, setRejectNote] = useState('')
  const [roomStatus, setRoomStatus] = useState<DbRoomStatus>('available')
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [guestPhotoUrl, setGuestPhotoUrl] = useState<string | null>(null)
  const selectedRef = useRef<Complaint | null>(null)
  selectedRef.current = selected

  const load = useCallback(async () => {
    const [cResult, tResult] = await Promise.all([getHotelComplaints(), getTechnicians()])
    if (cResult.success && cResult.data) setComplaints(cResult.data)
    if (tResult.success && tResult.data) setTechnicians(tResult.data)
  }, [])

  const refreshFromRealtime = useCallback(async () => {
    const [cResult, tResult] = await Promise.all([getHotelComplaints(), getTechnicians()])
    if (cResult.success && cResult.data) {
      setComplaints(cResult.data)
      const current = selectedRef.current
      if (current) {
        const updated = cResult.data.find((c) => c.id === current.id)
        if (updated) {
          setSelected(updated)
          const [evResult, estResult] = await Promise.all([
            getComplaintEvents(updated.id),
            fetchComplaintEstimate(updated.id),
          ])
          if (evResult.success && evResult.data) setEvents(evResult.data)
          if (estResult.success) setEstimate(estResult.data ?? null)
        } else {
          setSelected(null)
          setEvents([])
          setEstimate(null)
        }
      }
    }
    if (tResult.success && tResult.data) setTechnicians(tResult.data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh('complaints', refreshFromRealtime)

  const pending = useMemo(
    () => complaints.filter((c) => c.status === 'pending_approval'),
    [complaints],
  )

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return complaints
    return complaints.filter((c) => c.status === statusFilter)
  }, [complaints, statusFilter])

  async function openDetail(complaint: Complaint) {
    setSelected(complaint)
    setRejectNote('')
    setEstimate(null)
    setGuestPhotoUrl(null)
    const [evResult, estResult, photoResult] = await Promise.all([
      getComplaintEvents(complaint.id),
      fetchComplaintEstimate(complaint.id),
      complaint.guest_photo_path
        ? getStaffComplaintPhotoUrl(complaint.id)
        : Promise.resolve({ success: false as const, error: '' }),
    ])
    if (evResult.success && evResult.data) setEvents(evResult.data)
    if (estResult.success) setEstimate(estResult.data ?? null)
    if (photoResult.success && photoResult.data) setGuestPhotoUrl(photoResult.data.url)
  }

  function closeDetail() {
    setSelected(null)
    setRejectNote('')
    setEstimate(null)
    setGuestPhotoUrl(null)
  }

  async function handleAssign(techId: string) {
    if (!selected) return
    setLoading(true)
    await assignComplaint(selected.id, techId)
    setLoading(false)
    await load()
    closeDetail()
  }

  async function handleApprove() {
    if (!selected) return
    setLoading(true)
    await approveComplaint(selected.id, roomStatus)
    setLoading(false)
    await load()
    closeDetail()
  }

  async function handleReject() {
    if (!selected || !rejectNote.trim()) return
    setLoading(true)
    await rejectComplaint(selected.id, rejectNote)
    setLoading(false)
    await load()
    closeDetail()
  }

  const SelectedIcon = selected ? categoryIcons[selected.category] : HelpCircle

  return (
    <div className="space-y-6">
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

      {pending.length > 0 && (
        <section className={`${liftCard} bg-gradient-to-br from-white to-[#D85A30]/5 p-5`}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D85A30]/12">
              <Clock className="h-4 w-4 text-[#D85A30]" />
            </div>
            <h3 className="font-semibold text-[#D85A30]">
              Pending approvals ({pending.length})
            </h3>
          </div>
          <div className="mt-4 space-y-2">
            {pending.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelected(c)
                  setRejectNote('')
                  void getComplaintEvents(c.id).then((r) => {
                    if (r.success && r.data) setEvents(r.data)
                  })
                  void fetchComplaintEstimate(c.id).then((r) => {
                    if (r.success) setEstimate(r.data ?? null)
                  })
                }}
                className={`${liftCard} flex w-full items-center justify-between gap-3 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-elevation-2`}
              >
                <div>
                  <p className="font-semibold text-foreground">
                    Room {roomNumberOf(c) ?? '—'} · {formatLabel(c.category)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{c.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#D85A30]/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#D85A30]">
                  {managerPendingLabel(c)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {(['all', 'open', 'assigned', 'in_progress', 'pending_approval', 'resolved'] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-all ${
                statusFilter === s
                  ? 'bg-[#3C216C] text-white shadow-elevation-2'
                  : 'bg-white text-foreground shadow-elevation-1 hover:shadow-elevation-2'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ),
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((c) => {
          const Icon = categoryIcons[c.category]
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => openDetail(c)}
              className={`flex w-full items-center gap-4 rounded-2xl bg-white px-4 py-3.5 text-left shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2 ${priorityAccent[c.priority ?? 'medium']}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3C216C]/6">
                <Icon className="h-5 w-5 text-[#3C216C]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <p className="font-semibold capitalize text-foreground">{c.category}</p>
                  {roomNumberOf(c) && (
                    <span className="rounded-md bg-[#3C216C]/8 px-2 py-0.5 text-[11px] font-semibold text-[#3C216C]">
                      Room {roomNumberOf(c)}
                    </span>
                  )}
                  {guestNameOf(c) && (
                    <span className="text-xs text-muted-foreground">{guestNameOf(c)}</span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{c.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadge(c.status)}`}
              >
                {c.status?.replace('_', ' ')}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className={`${liftCard} p-10 text-center text-sm text-muted-foreground`}>
            No complaints match this filter.
          </div>
        )}
      </div>

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
                  {formatLabel(selected.status ?? 'open')}
                </span>
              </div>
            </div>

            <SheetContent className="space-y-4">
              <div className={`${liftCard} p-4`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Description
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{selected.description}</p>
              </div>

              {guestPhotoUrl && (
                <div className={`${liftCard} overflow-hidden p-4`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Guest photo
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={guestPhotoUrl}
                    alt="Guest attachment"
                    className="mt-3 max-h-64 w-full rounded-xl object-contain"
                  />
                </div>
              )}

              {selected.guest_id && (
                <StaffComplaintMessageThread complaintId={selected.id} />
              )}

              {(guestPhoneOf(selected) || selected.assignee?.phone) && (
                <div className={`${liftCard} space-y-3 p-4`}>
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

              {(selected.scheduled_visit_at ||
                ['open', 'assigned', 'in_progress', 'rejected'].includes(selected.status ?? '')) && (
                <div className={`${liftCard} p-4`}>
                  <ScheduledVisitDisplay
                    scheduledVisitAt={selected.scheduled_visit_at}
                    pendingMessage={
                      !selected.scheduled_visit_at
                        ? 'Technician will contact the guest to agree a visit time.'
                        : undefined
                    }
                  />
                </div>
              )}

              {selected.status === 'pending_approval' && isPendingEstimate(selected) && (
                <div className="overflow-hidden rounded-2xl bg-amber-500/10 p-5 shadow-elevation-1">
                  <p className="text-sm font-semibold text-amber-900">Legacy invoice queue</p>
                  <p className="mt-2 text-sm text-amber-950/80">
                    Invoices no longer require approval. Release this job so the technician can
                    continue.
                  </p>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={loading}
                    className="mt-4 w-full rounded-xl bg-[#3C216C] py-3 text-sm font-semibold text-white shadow-elevation-1 disabled:opacity-60"
                  >
                    {loading ? 'Releasing…' : 'Release to technician'}
                  </button>
                </div>
              )}

              {selected.status === 'pending_approval' && isPendingCompletion(selected) && (
                <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-[#D85A30]/10 via-white to-white p-5 shadow-elevation-2">
                  <div className="mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#D85A30]" />
                    <h3 className="text-sm font-semibold text-[#D85A30]">
                      {needsGuestCompletionApproval(selected)
                        ? 'Awaiting guest sign-off'
                        : 'Manager sign-off'}
                    </h3>
                  </div>
                  {needsGuestCompletionApproval(selected) ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      The technician has finished. The guest will confirm in their portal. You will
                      be notified once they approve.
                    </p>
                  ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Room status after approval
                      </label>
                      <select
                        value={roomStatus}
                        onChange={(e) => setRoomStatus(e.target.value as DbRoomStatus)}
                        className={softField}
                      >
                        <option value="available">Available</option>
                        <option value="occupied">Occupied</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="needs_inspection">Needs inspection</option>
                        <option value="cleaning">Cleaning</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={loading || !canManagerApproveCompletion(selected)}
                      className="gradient-primary w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-elevation-2 transition-all hover:-translate-y-0.5 hover:shadow-elevation-3 disabled:opacity-60"
                    >
                      {loading ? 'Approving…' : 'Approve & close job'}
                    </button>
                    <p className="text-center text-xs text-muted-foreground">or send back to technician</p>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Rejection note
                      </label>
                      <textarea
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                        placeholder="Explain what still needs to be fixed…"
                        className={`${softField} min-h-24 resize-none`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={loading || !rejectNote.trim()}
                      className="w-full rounded-xl bg-red-500/10 py-3.5 text-sm font-semibold text-red-700 shadow-elevation-1 transition-all hover:bg-red-500/15 hover:shadow-elevation-2 disabled:opacity-50"
                    >
                      Send back to technician
                    </button>
                  </div>
                  )}
                  {needsGuestCompletionApproval(selected) && (
                    <>
                      <p className="mt-4 text-center text-xs text-muted-foreground">
                        or send back to technician
                      </p>
                      <div className="mt-3">
                        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Rejection note
                        </label>
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="Explain what still needs to be fixed…"
                          className={`${softField} min-h-24 resize-none`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={loading || !rejectNote.trim()}
                        className="mt-3 w-full rounded-xl bg-red-500/10 py-3.5 text-sm font-semibold text-red-700 shadow-elevation-1 transition-all hover:bg-red-500/15 hover:shadow-elevation-2 disabled:opacity-50"
                      >
                        Send back to technician
                      </button>
                    </>
                  )}
                </div>
              )}

              {selected.status !== 'pending_approval' && selected.status !== 'resolved' && (
                <div className={`${liftCard} overflow-hidden`}>
                  <div className="flex items-center gap-2 px-4 pb-3 pt-4">
                    <UserPlus className="h-4 w-4 text-[#3C216C]" />
                    <h3 className="text-sm font-semibold text-[#3C216C]">Assign technician</h3>
                  </div>
                  <div className="px-4 pb-4">
                    <select
                      className={softField}
                      defaultValue=""
                      onChange={(e) => e.target.value && handleAssign(e.target.value)}
                      disabled={loading}
                    >
                      <option value="" disabled>
                        Select a technician…
                      </option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.specialty ? ` · ${t.specialty}` : ''}
                          {t.phone ? ` · ${t.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Timeline
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
                        <div className={`${liftCard} mb-1 flex-1 px-4 py-3`}>
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

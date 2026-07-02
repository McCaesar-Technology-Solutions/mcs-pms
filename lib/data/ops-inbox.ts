import { createAdminClient } from '@/lib/supabase/admin'
import { isPendingCompletion, needsGuestCompletionApproval } from '@/lib/complaints/workflow'
import { loadGuestConversations } from '@/lib/data/guest-conversations'
import type { Complaint } from '@/types'

export type OpsInboxKind =
  | 'complaint'
  | 'guest_request'
  | 'guest_message'
  | 'guest_stay_chat'
  | 'housekeeping'

export interface OpsInboxItem {
  id: string
  kind: OpsInboxKind
  title: string
  subtitle: string
  priority: number
  href: string
  createdAt: string
}

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping request',
  late_checkout: 'Late checkout request',
  extension: 'Stay extension request',
  self_checkout: 'Self check-out request',
}

function complaintPriority(c: Complaint): number {
  if (c.status === 'open' && !c.assigned_to) return 0
  if (c.status === 'pending_approval' && isPendingCompletion(c)) return 1
  if (c.status === 'open') return 2
  if (c.priority === 'urgent') return 3
  return 4
}

export async function loadOpsInbox(hotelId: string, limit = 12): Promise<OpsInboxItem[]> {
  const admin = createAdminClient()
  const items: OpsInboxItem[] = []

  const [complaintsRes, requestsRes, housekeepingRes, stayConversations, complaintIdsRes] =
    await Promise.all([
    admin
      .from('complaints')
      .select('id, category, status, priority, assigned_to, approval_stage, guest_id, guest_completion_approved_at, submitted_at, rooms(number)')
      .eq('hotel_id', hotelId)
      .neq('status', 'resolved')
      .order('submitted_at', { ascending: false })
      .limit(20),
    admin
      .from('guest_requests')
      .select('id, guest_id, request_type, requested_date, created_at, guests(name), rooms(number)')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('housekeeping_tasks')
      .select('id, task_type, status, priority, due_date, created_at, rooms(number)')
      .eq('hotel_id', hotelId)
      .neq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(15),
    loadGuestConversations(hotelId),
    admin.from('complaints').select('id').eq('hotel_id', hotelId),
  ])

  const complaintIds = (complaintIdsRes.data ?? []).map((c) => c.id)
  let messagesRes: { data: unknown[] | null } = { data: [] }
  if (complaintIds.length > 0) {
    messagesRes = await admin
      .from('complaint_messages')
      .select('id, complaint_id, body, created_at, complaints(category, rooms(number))')
      .in('complaint_id', complaintIds)
      .eq('author_role', 'guest')
      .order('created_at', { ascending: false })
      .limit(15)
  }

  for (const c of (complaintsRes.data ?? []) as unknown as Complaint[]) {
    const room = (c as Complaint & { rooms?: { number: string } }).rooms?.number
    let title = `${c.category} issue`
    let subtitle = room ? `Room ${room}` : 'Unassigned room'

    if (c.status === 'open' && !c.assigned_to) {
      title = `Assign technician — ${c.category}`
      subtitle = room ? `Room ${room} · New complaint` : 'New complaint'
    } else if (isPendingCompletion(c)) {
      title = needsGuestCompletionApproval(c)
        ? 'Awaiting guest sign-off'
        : 'Approve completion'
      subtitle = room ? `Room ${room} · ${c.category}` : c.category
    } else if (c.status === 'pending_approval') {
      title = 'Pending approval'
      subtitle = room ? `Room ${room}` : c.category
    }

    items.push({
      id: c.id,
      kind: 'complaint',
      title,
      subtitle,
      priority: complaintPriority(c),
      href: `/manager/complaints?complaint=${c.id}`,
      createdAt: c.submitted_at ?? new Date().toISOString(),
    })
  }

  const requestGuestIds = Array.from(
    new Set(
      (requestsRes.data ?? [])
        .map((r) => ('guest_id' in r ? r.guest_id : null))
        .filter((guestId): guestId is string => Boolean(guestId)),
    ),
  )
  const requestReservationIds = new Map<string, string>()
  if (requestGuestIds.length > 0) {
    const { data: activeReservations } = await admin
      .from('reservations')
      .select('id, guest_id')
      .eq('hotel_id', hotelId)
      .in('guest_id', requestGuestIds)
      .in('status', ['checked_in', 'overstay', 'checkout_in_progress'])

    for (const reservation of activeReservations ?? []) {
      if (!reservation.guest_id || requestReservationIds.has(reservation.guest_id)) continue
      requestReservationIds.set(reservation.guest_id, reservation.id)
    }
  }

  for (const r of requestsRes.data ?? []) {
    const guest = r.guests as { name?: string } | null
    const room = r.rooms as { number?: string } | null
    const reservationId = 'guest_id' in r && r.guest_id ? requestReservationIds.get(r.guest_id) : null
    const extensionHref =
      r.request_type === 'extension' && reservationId && 'requested_date' in r && r.requested_date
        ? `/manager/reservations?open=${encodeURIComponent(reservationId)}&extend=1&extendDate=${encodeURIComponent(r.requested_date)}&guestRequest=${encodeURIComponent(r.id)}`
        : '/manager/dashboard#guest-requests'
    items.push({
      id: r.id,
      kind: 'guest_request',
      title: REQUEST_LABELS[r.request_type] ?? 'Guest request',
      subtitle:
        `${guest?.name ?? 'Guest'}${room?.number ? ` · Room ${room.number}` : ''}` +
        (r.request_type === 'extension' && 'requested_date' in r && r.requested_date
          ? ` · wants ${r.requested_date}`
          : ''),
      priority: r.request_type === 'self_checkout' ? 1 : 2,
      href: extensionHref,
      createdAt: r.created_at ?? new Date(0).toISOString(),
    })
  }

  const today = new Date().toISOString().split('T')[0]
  for (const task of housekeepingRes.data ?? []) {
    const room = task.rooms as { number?: string } | null
    const isInspect = task.task_type === 'inspect'
    const isOverdue = task.due_date && task.due_date < today
    items.push({
      id: task.id,
      kind: 'housekeeping',
      title: isInspect
        ? `Inspect room ${room?.number ?? '?'}`
        : isOverdue
          ? `Overdue ${task.task_type} — Room ${room?.number ?? '?'}`
          : `Housekeeping — Room ${room?.number ?? '?'}`,
      subtitle: isInspect
        ? 'Clean complete — approve before available'
        : `${task.task_type} · ${task.priority} priority`,
      priority: isInspect ? 0 : isOverdue ? 1 : 3,
      href: '/manager/housekeeping',
      createdAt: task.created_at ?? new Date(0).toISOString(),
    })
  }

  for (const conv of stayConversations.filter((c) => c.unread)) {
    items.push({
      id: conv.id,
      kind: 'guest_stay_chat',
      title: `Message from ${conv.guestName}`,
      subtitle: `${conv.roomNumber ? `Room ${conv.roomNumber} · ` : ''}${conv.lastMessageBody?.slice(0, 60) ?? 'New message'}`,
      priority: 1,
      href: `/manager/messages?conversation=${conv.id}`,
      createdAt: conv.lastMessageAt ?? new Date(0).toISOString(),
    })
  }

  const seenComplaints = new Set<string>()
  type GuestMessageRow = {
    complaint_id: string
    body: string
    created_at: string | null
    complaints: { category?: string; rooms?: { number?: string } } | null
  }

  for (const m of (messagesRes.data ?? []) as GuestMessageRow[]) {
    if (seenComplaints.has(m.complaint_id)) continue
    const complaint = m.complaints as { category?: string; rooms?: { number?: string } } | null
    if (!complaint) continue
    seenComplaints.add(m.complaint_id)
    items.push({
      id: m.complaint_id,
      kind: 'guest_message',
      title: 'Guest chat message',
      subtitle: `${complaint.rooms?.number ? `Room ${complaint.rooms.number} · ` : ''}${m.body.slice(0, 60)}`,
      priority: 2,
      href: `/manager/complaints?complaint=${m.complaint_id}`,
      createdAt: m.created_at ?? new Date(0).toISOString(),
    })
  }

  return items
    .sort((a, b) => a.priority - b.priority || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

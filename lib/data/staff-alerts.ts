import { getProfile } from '@/lib/auth/get-profile'
import { isPendingCompletion, needsGuestCompletionApproval } from '@/lib/complaints/workflow'
import { loadGuestConversations } from '@/lib/data/guest-conversations'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { createClient } from '@/lib/supabase/server'
import type { Complaint, UserRole } from '@/types'

export type StaffAlertKind =
  | 'overdue_invoice'
  | 'pending_invoice'
  | 'checkin_today'
  | 'checkout_today'
  | 'pending_complaint'
  | 'complaint_approval'
  | 'unassigned_complaint'
  | 'guest_request'
  | 'guest_stay_chat'
  | 'guest_message'
  | 'housekeeping_inspect'
  | 'housekeeping_overdue'

export interface StaffAlert {
  id: string
  kind: StaffAlertKind
  title: string
  subtitle: string
  href: string
  /** Nav route href used for sidebar badge aggregation */
  badgeHref: string
  urgent: boolean
  sort: number
}

const REQUEST_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping request',
  late_checkout: 'Late checkout request',
  extension: 'Stay extension request',
  self_checkout: 'Self check-out request',
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function basePath(role: UserRole): string {
  if (role === 'owner') return '/owner'
  if (role === 'receptionist') return '/receptionist'
  return '/manager'
}

function messagesHref(prefix: string, conversationId?: string): string {
  if (prefix === '/receptionist') {
    return conversationId
      ? `/receptionist/messages?conversation=${conversationId}`
      : '/receptionist/messages'
  }
  if (prefix === '/owner') {
    return conversationId ? `/owner/dashboard#guest-portal` : '/owner/dashboard'
  }
  return conversationId
    ? `/manager/messages?conversation=${conversationId}`
    : '/manager/messages'
}

function guestRequestsHref(prefix: string): string {
  if (prefix === '/owner') return '/owner/settings#guest-requests'
  if (prefix === '/receptionist') return '/receptionist/dashboard#guest-requests'
  return '/manager/dashboard#guest-requests'
}

export async function fetchStaffAlerts(limit = 30): Promise<StaffAlert[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return []
  }

  const supabase = await createClient()
  const hotelId = profile.hotel_id
  const role = profile.role
  const prefix = basePath(role)
  const today = todayISO()
  const items: StaffAlert[] = []

  const includeBilling = role === 'owner'
  const includeGuestPortal = role === 'owner' || role === 'manager' || role === 'receptionist'

  const [
    invoicesRes,
    checkoutsRes,
    checkinsRes,
    complaintsRes,
    requestsRes,
    housekeepingRes,
    stayConversations,
  ] = await Promise.all([
    includeBilling
      ? supabase
          .from('invoices')
          .select('id, guest_name, invoice_number, total_amount, due_at, payment_status')
          .eq('hotel_id', hotelId)
          .in('payment_status', ['pending', 'overdue'])
          .order('due_at')
          .limit(12)
      : Promise.resolve({ data: [] }),
    supabase
      .from('reservations')
      .select('id, guest_name, check_out, status, rooms(number)')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')
      .eq('check_out', today),
    supabase
      .from('reservations')
      .select('id, guest_name, check_in, status, rooms(number)')
      .eq('hotel_id', hotelId)
      .in('status', ['confirmed', 'checked_in'])
      .eq('check_in', today),
    supabase
      .from('complaints')
      .select(
        'id, category, status, priority, assigned_to, approval_stage, guest_id, guest_completion_approved_at, rooms(number)',
      )
      .eq('hotel_id', hotelId)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(20),
    includeGuestPortal
      ? supabase
          .from('guest_requests')
          .select('id, request_type, created_at, guests(name), rooms(number)')
          .eq('hotel_id', hotelId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    role !== 'receptionist'
      ? supabase
          .from('housekeeping_tasks')
          .select('id, task_type, status, priority, due_date, rooms(number)')
          .eq('hotel_id', hotelId)
          .neq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(15)
      : Promise.resolve({ data: [] }),
    includeGuestPortal ? loadGuestConversations(hotelId) : Promise.resolve([]),
  ])

  for (const inv of invoicesRes.data ?? []) {
    const due = inv.due_at?.slice(0, 10) ?? today
    const overdue = due < today
    items.push({
      id: `inv-${inv.id}`,
      kind: overdue ? 'overdue_invoice' : 'pending_invoice',
      title: overdue ? 'Overdue invoice' : 'Pending payment',
      subtitle: `${formatInvoiceNumber(inv)} · ${inv.guest_name} · GHS ${(inv.total_amount ?? 0).toLocaleString()}`,
      href: `${prefix}/billing?q=${encodeURIComponent(formatInvoiceNumber(inv))}`,
      badgeHref: `${prefix}/billing`,
      urgent: overdue,
      sort: overdue ? 0 : 4,
    })
  }

  for (const res of checkoutsRes.data ?? []) {
    const room = res.rooms as { number?: string } | null
    items.push({
      id: `co-${res.id}`,
      kind: 'checkout_today',
      title: 'Check-out today',
      subtitle: `${res.guest_name}${room?.number ? ` · Room ${room.number}` : ''}`,
      href: `${prefix}/reservations?open=${res.id}`,
      badgeHref: `${prefix}/reservations`,
      urgent: false,
      sort: 6,
    })
  }

  for (const res of checkinsRes.data ?? []) {
    const room = res.rooms as { number?: string } | null
    const awaiting = res.status === 'confirmed'
    items.push({
      id: `ci-${res.id}`,
      kind: 'checkin_today',
      title: awaiting ? 'Arrival today — not checked in' : 'Check-in today',
      subtitle: `${res.guest_name}${room?.number ? ` · Room ${room.number}` : ''}`,
      href: `${prefix}/reservations?open=${res.id}`,
      badgeHref: `${prefix}/reservations`,
      urgent: awaiting,
      sort: awaiting ? 1 : 5,
    })
  }

  type ComplaintRow = Pick<
    Complaint,
    | 'id'
    | 'category'
    | 'status'
    | 'priority'
    | 'assigned_to'
    | 'approval_stage'
    | 'guest_id'
    | 'guest_completion_approved_at'
  > & {
    rooms: { number?: string } | null
  }

  for (const c of (complaintsRes.data ?? []) as ComplaintRow[]) {
    const room = c.rooms?.number
    const complaintsHref = `${prefix}/complaints${c.id ? `?complaint=${c.id}` : ''}`

    if (c.status === 'pending_approval') {
      const pendingCompletion = isPendingCompletion(c)
      items.push({
        id: `cmp-ap-${c.id}`,
        kind: 'complaint_approval',
        title:
          c.approval_stage === 'estimate'
            ? 'Legacy invoice queue'
            : pendingCompletion
              ? needsGuestCompletionApproval(c)
                ? 'Awaiting guest sign-off'
                : 'Approve job completion'
              : 'Job awaiting sign-off',
        subtitle: `${c.category}${room ? ` · Room ${room}` : ''}`,
        href: complaintsHref,
        badgeHref: `${prefix}/complaints`,
        urgent: true,
        sort: 0,
      })
      continue
    }

    if (c.status === 'open' && !c.assigned_to) {
      items.push({
        id: `cmp-un-${c.id}`,
        kind: 'unassigned_complaint',
        title: `Assign technician — ${c.category}`,
        subtitle: room ? `Room ${room} · New complaint` : 'New complaint',
        href: complaintsHref,
        badgeHref: `${prefix}/complaints`,
        urgent: true,
        sort: 1,
      })
      continue
    }

    if (c.status && ['open', 'assigned', 'in_progress'].includes(c.status)) {
      items.push({
        id: `cmp-${c.id}`,
        kind: 'pending_complaint',
        title: c.priority === 'urgent' ? 'Urgent complaint' : 'Open complaint',
        subtitle: `${c.category}${room ? ` · Room ${room}` : ''}`,
        href: complaintsHref,
        badgeHref: `${prefix}/complaints`,
        urgent: c.priority === 'urgent',
        sort: c.priority === 'urgent' ? 2 : 5,
      })
    }
  }

  for (const r of requestsRes.data ?? []) {
    const guest = r.guests as { name?: string } | null
    const room = r.rooms as { number?: string } | null
    items.push({
      id: `gr-${r.id}`,
      kind: 'guest_request',
      title: REQUEST_LABELS[r.request_type] ?? 'Guest request',
      subtitle: `${guest?.name ?? 'Guest'}${room?.number ? ` · Room ${room.number}` : ''}`,
      href: guestRequestsHref(prefix),
      badgeHref:
        role === 'manager'
          ? '/manager/dashboard'
          : role === 'owner'
            ? '/owner/settings'
            : '/receptionist/dashboard',
      urgent: r.request_type === 'self_checkout',
      sort: r.request_type === 'self_checkout' ? 1 : 3,
    })
  }

  for (const task of housekeepingRes.data ?? []) {
    const room = task.rooms as { number?: string } | null
    const isInspect = task.task_type === 'inspect'
    const isOverdue = Boolean(task.due_date && task.due_date < today)
    if (!isInspect && !isOverdue) continue

    items.push({
      id: `hk-${task.id}`,
      kind: isInspect ? 'housekeeping_inspect' : 'housekeeping_overdue',
      title: isInspect
        ? `Inspect room ${room?.number ?? '?'}`
        : `Overdue ${task.task_type} — Room ${room?.number ?? '?'}`,
      subtitle: isInspect
        ? 'Clean complete — approve before available'
        : `${task.task_type} · ${task.priority} priority`,
      href: `${prefix}/housekeeping`,
      badgeHref: `${prefix}/housekeeping`,
      urgent: isInspect || isOverdue,
      sort: isInspect ? 1 : 2,
    })
  }

  for (const conv of stayConversations.filter((c) => c.unread)) {
    items.push({
      id: `chat-${conv.id}`,
      kind: 'guest_stay_chat',
      title: `Message from ${conv.guestName}`,
      subtitle: `${conv.roomNumber ? `Room ${conv.roomNumber} · ` : ''}${conv.lastMessageBody?.slice(0, 60) ?? 'New message'}`,
      href: messagesHref(prefix, conv.id),
      badgeHref: messagesHref(prefix),
      urgent: true,
      sort: 1,
    })
  }

  if (role === 'manager' || role === 'owner') {
    const complaintIds = (complaintsRes.data ?? []).map((c: { id: string }) => c.id)
    if (complaintIds.length > 0) {
      const { data: guestMessages } = await supabase
        .from('complaint_messages')
        .select('id, complaint_id, body, created_at, complaints(category, rooms(number))')
        .in('complaint_id', complaintIds)
        .eq('author_role', 'guest')
        .order('created_at', { ascending: false })
        .limit(10)

      const seen = new Set<string>()
      type GuestMsg = {
        complaint_id: string
        body: string
        complaints: { category?: string; rooms?: { number?: string } } | null
      }

      for (const m of (guestMessages ?? []) as GuestMsg[]) {
        if (seen.has(m.complaint_id)) continue
        seen.add(m.complaint_id)
        const complaint = m.complaints
        items.push({
          id: `gmsg-${m.complaint_id}`,
          kind: 'guest_message',
          title: 'Guest message on complaint',
          subtitle: `${complaint?.rooms?.number ? `Room ${complaint.rooms.number} · ` : ''}${m.body.slice(0, 60)}`,
          href: `${prefix}/complaints?complaint=${m.complaint_id}`,
          badgeHref: `${prefix}/complaints`,
          urgent: true,
          sort: 2,
        })
      }
    }
  }

  return items.sort((a, b) => a.sort - b.sort || Number(b.urgent) - Number(a.urgent)).slice(0, limit)
}

/** Sidebar badge counts keyed by nav href */
export async function getNavBadgeMap(): Promise<Record<string, number>> {
  const profile = await getProfile()
  if (!profile?.hotel_id || !['owner', 'manager', 'receptionist'].includes(profile.role)) {
    return {}
  }

  const alerts = await fetchStaffAlerts(50)
  const map: Record<string, number> = {}

  for (const alert of alerts) {
    map[alert.badgeHref] = (map[alert.badgeHref] ?? 0) + 1
  }

  const prefix = basePath(profile.role)
  const dashboardHref = `${prefix}/dashboard`
  const urgentCount = alerts.filter((a) => a.urgent).length
  if (urgentCount > 0) {
    map[dashboardHref] = urgentCount
  }

  return map
}

/** Manager dashboard tab badge counts */
export async function getManagerTabBadges(): Promise<{ overview: number; guestPortal: number }> {
  const profile = await getProfile()
  if (!profile?.hotel_id || profile.role !== 'manager') {
    return { overview: 0, guestPortal: 0 }
  }

  const alerts = await fetchStaffAlerts(50)
  return {
    overview: alerts.filter((a) => a.kind !== 'guest_request').length,
    guestPortal: alerts.filter((a) => a.kind === 'guest_request').length,
  }
}

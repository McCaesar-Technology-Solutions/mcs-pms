import { getProfile } from '@/lib/auth/get-profile'
import { createClient } from '@/lib/supabase/server'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import type { UserRole } from '@/types'

export type NotificationKind = 'overdue_invoice' | 'checkout_today' | 'pending_complaint'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  subtitle: string
  href: string
  urgent: boolean
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function basePath(role: UserRole): string {
  return role === 'owner' ? '/owner' : '/manager'
}

export async function getNotifications(): Promise<AppNotification[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id || !['owner', 'manager'].includes(profile.role)) return []

  const supabase = await createClient()
  const hotelId = profile.hotel_id
  const prefix = basePath(profile.role)
  const today = todayISO()
  const items: AppNotification[] = []

  const [invoicesRes, reservationsRes, complaintsRes] = await Promise.all([
    profile.role === 'owner'
      ? supabase
          .from('invoices')
          .select('id, guest_name, invoice_number, total_amount, due_at, payment_status')
          .eq('hotel_id', hotelId)
          .in('payment_status', ['pending', 'overdue'])
          .order('due_at')
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase
      .from('reservations')
      .select('id, guest_name, check_out, rooms(number)')
      .eq('hotel_id', hotelId)
      .eq('status', 'checked_in')
      .eq('check_out', today),
    supabase
      .from('complaints')
      .select('id, category, status, priority')
      .eq('hotel_id', hotelId)
      .in('status', ['open', 'assigned', 'in_progress', 'pending_approval'])
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  for (const inv of invoicesRes.data ?? []) {
    const due = inv.due_at?.slice(0, 10) ?? today
    const overdue = due < today
    items.push({
      id: `inv-${inv.id}`,
      kind: 'overdue_invoice',
      title: overdue ? 'Overdue invoice' : 'Pending payment',
      subtitle: `${formatInvoiceNumber(inv)} · ${inv.guest_name} · GHS ${(inv.total_amount ?? 0).toLocaleString()}`,
      href: `${prefix}/billing?q=${encodeURIComponent(formatInvoiceNumber(inv))}`,
      urgent: overdue,
    })
  }

  for (const res of reservationsRes.data ?? []) {
    const room = res.rooms as { number?: string } | null
    items.push({
      id: `co-${res.id}`,
      kind: 'checkout_today',
      title: 'Check-out today',
      subtitle: `${res.guest_name}${room?.number ? ` · Room ${room.number}` : ''}`,
      href: `${prefix}/reservations?open=${res.id}`,
      urgent: false,
    })
  }

  for (const c of complaintsRes.data ?? []) {
    items.push({
      id: `cmp-${c.id}`,
      kind: 'pending_complaint',
      title: c.status === 'pending_approval' ? 'Estimate awaiting approval' : 'Open complaint',
      subtitle: `${c.category}${c.priority === 'urgent' ? ' · Urgent' : ''}`,
      href: `${prefix}/complaints`,
      urgent: c.priority === 'urgent' || c.status === 'pending_approval',
    })
  }

  return items.sort((a, b) => Number(b.urgent) - Number(a.urgent)).slice(0, 15)
}

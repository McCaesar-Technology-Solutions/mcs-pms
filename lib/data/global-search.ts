import { getProfile } from '@/lib/auth/get-profile'
import { staffRoutePrefix } from '@/lib/dashboard/search-hrefs'
import { formatInvoiceNumber } from '@/lib/invoices/numbering'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types'

export type GlobalSearchResultKind =
  | 'guest'
  | 'reservation'
  | 'room'
  | 'complaint'
  | 'invoice'
  | 'housekeeping'

export interface GlobalSearchResult {
  id: string
  kind: GlobalSearchResultKind
  label: string
  subtitle: string
  href: string
}

function sanitizeQuery(raw: string): string {
  return raw.trim().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

function prefixForRole(role: Profile['role']): string {
  if (role === 'technician') return '/technician'
  return staffRoutePrefix(role)
}

export async function searchGlobal(query: string, limit = 8): Promise<GlobalSearchResult[]> {
  const profile = await getProfile()
  if (!profile?.hotel_id) return []

  const q = sanitizeQuery(query)
  if (q.length < 2) return []

  const supabase = await createClient()
  const hotelId = profile.hotel_id
  const role = profile.role
  const prefix = prefixForRole(role)
  const pattern = `%${q}%`
  const perKind = Math.max(2, Math.ceil(limit / 4))
  const results: GlobalSearchResult[] = []

  const canBilling = role === 'owner'
  const canHousekeeping = role === 'owner' || role === 'manager'
  const canComplaints = role !== 'technician'

  const tasks: Promise<void>[] = []

  if (role !== 'technician') {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('guests')
          .select('id, name, phone, email, rooms(number)')
          .eq('hotel_id', hotelId)
          .or(`name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
          .order('name')
          .limit(perKind)

        for (const row of data ?? []) {
          const room = row.rooms as { number?: string } | null
          results.push({
            id: `guest-${row.id}`,
            kind: 'guest',
            label: row.name,
            subtitle: [room?.number ? `Room ${room.number}` : null, row.phone, row.email]
              .filter(Boolean)
              .join(' · ') || 'Guest',
            href: `${prefix}/guests?q=${encodeURIComponent(q)}`,
          })
        }
      })(),
    )

    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('reservations')
          .select('id, guest_name, check_in, check_out, status, rooms(number)')
          .eq('hotel_id', hotelId)
          .or(`guest_name.ilike.${pattern},id.ilike.${pattern}`)
          .order('check_in', { ascending: false })
          .limit(perKind)

        for (const row of data ?? []) {
          const room = row.rooms as { number?: string } | null
          results.push({
            id: `res-${row.id}`,
            kind: 'reservation',
            label: row.guest_name,
            subtitle: [
              room?.number ? `Room ${room.number}` : null,
              `${row.check_in} → ${row.check_out}`,
              row.status?.replace(/_/g, ' '),
            ]
              .filter(Boolean)
              .join(' · '),
            href: `${prefix}/reservations?open=${row.id}`,
          })
        }
      })(),
    )

    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('rooms')
          .select('id, number, status, floor')
          .eq('hotel_id', hotelId)
          .ilike('number', pattern)
          .order('number')
          .limit(perKind)

        for (const row of data ?? []) {
          results.push({
            id: `room-${row.id}`,
            kind: 'room',
            label: `Room ${row.number}`,
            subtitle: [row.status?.replace(/_/g, ' '), row.floor != null ? `Floor ${row.floor}` : null]
              .filter(Boolean)
              .join(' · '),
            href: `${prefix}/rooms?q=${encodeURIComponent(row.number)}`,
          })
        }
      })(),
    )
  }

  if (canComplaints) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('complaints')
          .select('id, category, description, status, rooms(number), guests(name)')
          .eq('hotel_id', hotelId)
          .or(`description.ilike.${pattern},category.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(perKind)

        for (const row of data ?? []) {
          const room = row.rooms as { number?: string } | null
          const guest = row.guests as { name?: string } | null
          results.push({
            id: `cmp-${row.id}`,
            kind: 'complaint',
            label: `${row.category}${room?.number ? ` · Room ${room.number}` : ''}`,
            subtitle: [guest?.name, row.description?.slice(0, 60), row.status?.replace(/_/g, ' ')]
              .filter(Boolean)
              .join(' · '),
            href: `${prefix}/complaints?complaint=${row.id}`,
          })
        }
      })(),
    )
  }

  if (canBilling) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('invoices')
          .select('id, guest_name, invoice_number, total_amount, payment_status')
          .eq('hotel_id', hotelId)
          .or(`guest_name.ilike.${pattern},invoice_number.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(perKind)

        for (const row of data ?? []) {
          const invNum = formatInvoiceNumber(row)
          results.push({
            id: `inv-${row.id}`,
            kind: 'invoice',
            label: invNum,
            subtitle: `${row.guest_name} · GHS ${(row.total_amount ?? 0).toLocaleString()} · ${row.payment_status ?? 'pending'}`,
            href: `${prefix}/billing?q=${encodeURIComponent(invNum)}`,
          })
        }
      })(),
    )
  }

  if (canHousekeeping) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('housekeeping_tasks')
          .select('id, task_type, status, rooms(number)')
          .eq('hotel_id', hotelId)
          .neq('status', 'done')
          .order('created_at', { ascending: false })
          .limit(20)

        for (const row of data ?? []) {
          const room = row.rooms as { number?: string } | null
          const roomNum = room?.number ?? ''
          if (!roomNum.toLowerCase().includes(q.toLowerCase()) && !row.task_type.includes(q.toLowerCase())) {
            continue
          }
          results.push({
            id: `hk-${row.id}`,
            kind: 'housekeeping',
            label: roomNum ? `Room ${roomNum}` : 'Housekeeping task',
            subtitle: `${row.task_type.replace(/_/g, ' ')} · ${row.status?.replace(/_/g, ' ')}`,
            href: `${prefix}/housekeeping?q=${encodeURIComponent(q)}`,
          })
        }
      })(),
    )
  }

  if (role === 'technician') {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from('complaints')
          .select('id, category, description, status, rooms(number), guests(name)')
          .eq('hotel_id', hotelId)
          .or(`description.ilike.${pattern},category.ilike.${pattern}`)
          .order('created_at', { ascending: false })
          .limit(perKind)

        for (const row of data ?? []) {
          const room = row.rooms as { number?: string } | null
          results.push({
            id: `cmp-${row.id}`,
            kind: 'complaint',
            label: `${row.category}${room?.number ? ` · Room ${room.number}` : ''}`,
            subtitle: row.description?.slice(0, 80) ?? row.status ?? 'Job',
            href: `/technician/tasks?q=${encodeURIComponent(q)}`,
          })
        }
      })(),
    )
  }

  await Promise.all(tasks)

  return results.slice(0, limit)
}

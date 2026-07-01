'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { consumeStaffAuthError } from '@/lib/auth/staff-session'
import { reconcileHotelBillingState } from '@/lib/billing/reconcile-hotel-billing'
import { writeAuditLog } from '@/lib/audit/log'
import { todayISO } from '@/lib/stays/helpers'

export type NightAuditResult =
  | { success: true; data?: { id: string } }
  | { success: false; error: string }

export async function runNightAudit(notes?: string): Promise<NightAuditResult> {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: consumeStaffAuthError() }
  }

  const businessDate = todayISO()
  const supabase = await createClient()
  const admin = createAdminClient()

  await reconcileHotelBillingState(admin, profile.hotel_id)

  const { data: existing } = await supabase
    .from('night_audits')
    .select('id')
    .eq('hotel_id', profile.hotel_id)
    .eq('business_date', businessDate)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'Night audit already closed for today.' }
  }

  const [{ data: rooms }, { data: reservations }, { data: invoices }] = await Promise.all([
    supabase.from('rooms').select('status').eq('hotel_id', profile.hotel_id),
    supabase
      .from('reservations')
      .select('status, check_in, check_out')
      .eq('hotel_id', profile.hotel_id),
    supabase
      .from('invoices')
      .select('total_amount, payment_status, issued_at')
      .eq('hotel_id', profile.hotel_id)
      .gte('issued_at', `${businessDate}T00:00:00`)
      .lte('issued_at', `${businessDate}T23:59:59`),
  ])

  const roomRows = rooms ?? []
  const occupied = roomRows.filter((r) => r.status === 'occupied').length
  const available = roomRows.filter((r) => r.status === 'available').length

  const resRows = reservations ?? []
  const arrivals = resRows.filter((r) => r.check_in === businessDate && r.status === 'checked_in').length
  const departures = resRows.filter(
    (r) => r.check_out === businessDate && (r.status === 'checked_out' || r.status === 'checked_in'),
  ).length

  const revenue = (invoices ?? [])
    .filter((i) => i.payment_status === 'paid')
    .reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0)

  const { data, error } = await supabase
    .from('night_audits')
    .insert({
      hotel_id: profile.hotel_id,
      business_date: businessDate,
      closed_by: profile.id,
      rooms_occupied: occupied,
      rooms_available: available,
      arrivals,
      departures,
      revenue_posted: revenue,
      notes: notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  void writeAuditLog({
    hotelId: profile.hotel_id,
    actorId: profile.id,
    actorName: profile.name,
    entityType: 'hotel',
    entityId: profile.hotel_id,
    action: 'night_audit',
    summary: `Closed night audit for ${businessDate}`,
    details: { arrivals, departures, occupied, revenue },
  })

  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
  return { success: true, data: { id: data.id } }
}

export async function getRecentNightAudits(limit = 30) {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager'].includes(profile.role)) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('night_audits')
    .select('*')
    .eq('hotel_id', profile.hotel_id)
    .order('business_date', { ascending: false })
    .limit(limit)

  return data ?? []
}

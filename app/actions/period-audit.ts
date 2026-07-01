'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVerifiedProfile } from '@/lib/auth/get-profile'
import { consumeStaffAuthError } from '@/lib/auth/staff-session'
import { reconcileHotelBillingState } from '@/lib/billing/reconcile-hotel-billing'
import { writeAuditLog } from '@/lib/audit/log'
import { computeCloseMetrics } from '@/lib/audits/compute-close-metrics'
import {
  currentCalendarMonth,
  currentCalendarYear,
  periodAuditLabel,
  type PeriodAuditType,
} from '@/lib/audits/period'

export type PeriodAuditResult =
  | { success: true; data?: { id: string } }
  | { success: false; error: string }

export interface PeriodAuditRow {
  id: string
  period_type: PeriodAuditType
  period_year: number
  period_month: number | null
  period_key: string
  rooms_occupied: number
  rooms_available: number
  arrivals: number
  departures: number
  revenue_posted: number
  night_audits_count: number
  notes: string | null
  closed_at: string | null
}

async function requireAuditProfile() {
  const profile = await getVerifiedProfile()
  if (!profile?.hotel_id || !['owner', 'manager'].includes(profile.role)) {
    return null
  }
  return profile
}

async function insertPeriodAudit(input: {
  hotelId: string
  profileId: string
  profileName: string
  periodType: PeriodAuditType
  year: number
  month: number | null
  periodKey: string
  startDate: string
  endDate: string
  notes?: string
}): Promise<PeriodAuditResult> {
  const supabase = await createClient()
  const admin = createAdminClient()

  await reconcileHotelBillingState(admin, input.hotelId)

  const existingQuery = supabase
    .from('period_audits')
    .select('id')
    .eq('hotel_id', input.hotelId)
    .eq('period_type', input.periodType)

  const { data: existing } =
    input.periodType === 'monthly'
      ? await existingQuery.eq('period_key', input.periodKey).maybeSingle()
      : await existingQuery.eq('period_year', input.year).maybeSingle()

  if (existing) {
    const label = periodAuditLabel(input.periodType, input.year, input.month)
    return {
      success: false,
      error: `${input.periodType === 'monthly' ? 'Monthly' : 'Yearly'} audit already closed for ${label}.`,
    }
  }

  const metrics = await computeCloseMetrics(supabase, input.hotelId, input.startDate, input.endDate)

  const { data, error } = await supabase
    .from('period_audits')
    .insert({
      hotel_id: input.hotelId,
      period_type: input.periodType,
      period_year: input.year,
      period_month: input.month,
      period_key: input.periodKey,
      closed_by: input.profileId,
      rooms_occupied: metrics.roomsOccupied,
      rooms_available: metrics.roomsAvailable,
      arrivals: metrics.arrivals,
      departures: metrics.departures,
      revenue_posted: metrics.revenuePosted,
      night_audits_count: metrics.nightAuditsCount,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const label = periodAuditLabel(input.periodType, input.year, input.month)
  void writeAuditLog({
    hotelId: input.hotelId,
    actorId: input.profileId,
    actorName: input.profileName,
    entityType: 'hotel',
    entityId: input.hotelId,
    action: input.periodType === 'monthly' ? 'monthly_audit' : 'yearly_audit',
    summary: `Closed ${input.periodType} audit for ${label}`,
    details: {
      arrivals: metrics.arrivals,
      departures: metrics.departures,
      occupied: metrics.roomsOccupied,
      revenue: metrics.revenuePosted,
      nightAuditsCount: metrics.nightAuditsCount,
    },
  })

  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
  return { success: true, data: { id: data.id } }
}

export async function runMonthlyAudit(notes?: string): Promise<PeriodAuditResult> {
  const profile = await requireAuditProfile()
  if (!profile) return { success: false, error: consumeStaffAuthError() }

  const month = currentCalendarMonth()
  return insertPeriodAudit({
    hotelId: profile.hotel_id!,
    profileId: profile.id,
    profileName: profile.name ?? 'Staff',
    periodType: 'monthly',
    year: month.year,
    month: month.month,
    periodKey: month.key,
    startDate: month.startDate,
    endDate: month.endDate,
    notes,
  })
}

export async function runYearlyAudit(notes?: string): Promise<PeriodAuditResult> {
  const profile = await requireAuditProfile()
  if (!profile) return { success: false, error: consumeStaffAuthError() }

  const year = currentCalendarYear()
  return insertPeriodAudit({
    hotelId: profile.hotel_id!,
    profileId: profile.id,
    profileName: profile.name ?? 'Staff',
    periodType: 'yearly',
    year: year.year,
    month: null,
    periodKey: year.key,
    startDate: year.startDate,
    endDate: year.endDate,
    notes,
  })
}

export async function getPeriodAudits(
  periodType: PeriodAuditType,
  limit = 24,
): Promise<PeriodAuditRow[]> {
  const profile = await requireAuditProfile()
  if (!profile) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('period_audits')
    .select('*')
    .eq('hotel_id', profile.hotel_id!)
    .eq('period_type', periodType)
    .order('closed_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as PeriodAuditRow[]
}

export async function isCurrentMonthAuditClosed(): Promise<boolean> {
  const profile = await requireAuditProfile()
  if (!profile) return false
  const month = currentCalendarMonth()
  const supabase = await createClient()
  const { data } = await supabase
    .from('period_audits')
    .select('id')
    .eq('hotel_id', profile.hotel_id!)
    .eq('period_type', 'monthly')
    .eq('period_key', month.key)
    .maybeSingle()
  return Boolean(data)
}

export async function isCurrentYearAuditClosed(): Promise<boolean> {
  const profile = await requireAuditProfile()
  if (!profile) return false
  const year = currentCalendarYear()
  const supabase = await createClient()
  const { data } = await supabase
    .from('period_audits')
    .select('id')
    .eq('hotel_id', profile.hotel_id!)
    .eq('period_type', 'yearly')
    .eq('period_year', year.year)
    .maybeSingle()
  return Boolean(data)
}

'use server'

import { revalidatePath } from 'next/cache'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import { createRoomCategorySchema, updateRoomCategorySchema } from '@/lib/validations'
import { writeAuditLog, moneyDelta } from '@/lib/audit/log'

export type RoomCategoryActionResult =
  | { success: true; id?: string }
  | { success: false; error: string }

function revalidateRoomViews() {
  revalidatePath('/owner/rooms')
  revalidatePath('/manager/rooms')
  revalidatePath('/receptionist/rooms')
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
  revalidatePath('/receptionist/dashboard')
}

async function requireStaff() {
  const result = await requireVerifiedStaff()
  if (!result.ok) return { supabase: result.supabase, profile: null }
  return { supabase: result.supabase, profile: result.profile }
}

export async function createRoomCategory(input: {
  name: string
  defaultNightlyRate: number
  defaultWeeklyRate?: number | ''
  defaultMonthlyRate?: number | ''
}): Promise<RoomCategoryActionResult> {
  const parsed = createRoomCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const weeklyRate =
    parsed.data.defaultWeeklyRate === '' || parsed.data.defaultWeeklyRate === undefined
      ? null
      : parsed.data.defaultWeeklyRate
  const monthlyRate =
    parsed.data.defaultMonthlyRate === '' || parsed.data.defaultMonthlyRate === undefined
      ? null
      : parsed.data.defaultMonthlyRate

  const { data, error } = await supabase
    .from('room_categories')
    .insert({
      hotel_id: profile.hotel_id,
      name: parsed.data.name.trim(),
      default_nightly_rate: parsed.data.defaultNightlyRate,
      default_weekly_rate: weeklyRate,
      default_monthly_rate: monthlyRate,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists.' }
    }
    return { success: false, error: error.message }
  }

  revalidateRoomViews()
  return { success: true, id: data.id }
}

export async function updateRoomCategory(
  id: string,
  input: {
    name?: string
    defaultNightlyRate?: number
    defaultWeeklyRate?: number | ''
    defaultMonthlyRate?: number | ''
  },
): Promise<RoomCategoryActionResult> {
  const parsed = updateRoomCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const payload: {
    name?: string
    default_nightly_rate?: number
    default_weekly_rate?: number | null
    default_monthly_rate?: number | null
  } = {}
  if (parsed.data.name !== undefined) payload.name = parsed.data.name.trim()
  if (parsed.data.defaultNightlyRate !== undefined) {
    payload.default_nightly_rate = parsed.data.defaultNightlyRate
  }
  if (parsed.data.defaultWeeklyRate !== undefined) {
    payload.default_weekly_rate =
      parsed.data.defaultWeeklyRate === '' ? null : parsed.data.defaultWeeklyRate
  }
  if (parsed.data.defaultMonthlyRate !== undefined) {
    payload.default_monthly_rate =
      parsed.data.defaultMonthlyRate === '' ? null : parsed.data.defaultMonthlyRate
  }

  const { data: existing } = await supabase
    .from('room_categories')
    .select('name, default_nightly_rate, default_weekly_rate, default_monthly_rate')
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  const { error } = await supabase
    .from('room_categories')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A category with this name already exists.' }
    }
    return { success: false, error: error.message }
  }

  if (existing) {
    const categoryName = parsed.data.name?.trim() ?? existing.name
    const changes: string[] = []
    const nightlyDelta = moneyDelta(
      'Default nightly rate',
      existing.default_nightly_rate,
      parsed.data.defaultNightlyRate ?? Number(existing.default_nightly_rate ?? 0),
    )
    if (nightlyDelta) changes.push(nightlyDelta)
    if (parsed.data.defaultWeeklyRate !== undefined) {
      const nextWeekly =
        parsed.data.defaultWeeklyRate === '' ? 0 : Number(parsed.data.defaultWeeklyRate ?? 0)
      const weeklyDelta = moneyDelta('Default weekly rate', existing.default_weekly_rate, nextWeekly)
      if (weeklyDelta) changes.push(weeklyDelta)
    }
    if (parsed.data.defaultMonthlyRate !== undefined) {
      const nextMonthly =
        parsed.data.defaultMonthlyRate === '' ? 0 : Number(parsed.data.defaultMonthlyRate ?? 0)
      const monthlyDelta = moneyDelta('Default monthly rate', existing.default_monthly_rate, nextMonthly)
      if (monthlyDelta) changes.push(monthlyDelta)
    }
    if (parsed.data.name !== undefined && parsed.data.name.trim() !== existing.name) {
      changes.push(`Name: ${existing.name} → ${parsed.data.name.trim()}`)
    }

    if (changes.length > 0) {
      void writeAuditLog({
        hotelId: profile.hotel_id,
        actorId: profile.id,
        actorName: profile.name,
        entityType: 'room_category',
        entityId: id,
        action: 'updated',
        summary: `Category ${categoryName}: ${changes.join('; ')}`,
      })
    }
  }

  revalidateRoomViews()
  return { success: true }
}

export async function deleteRoomCategory(id: string): Promise<RoomCategoryActionResult> {
  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const { count } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if ((count ?? 0) > 0) {
    return {
      success: false,
      error: 'Cannot delete a category that still has rooms assigned. Reassign those rooms first.',
    }
  }

  const { error } = await supabase
    .from('room_categories')
    .delete()
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  revalidateRoomViews()
  return { success: true }
}

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createRoomCategorySchema, updateRoomCategorySchema } from '@/lib/validations'

export type RoomCategoryActionResult =
  | { success: true; id?: string }
  | { success: false; error: string }

function revalidateRoomViews() {
  revalidatePath('/owner/rooms')
  revalidatePath('/manager/rooms')
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
}

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  return { supabase, profile }
}

export async function createRoomCategory(input: {
  name: string
  defaultNightlyRate: number
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
  input: { name?: string; defaultNightlyRate?: number; defaultMonthlyRate?: number | '' },
): Promise<RoomCategoryActionResult> {
  const parsed = updateRoomCategorySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  const payload: { name?: string; default_nightly_rate?: number; default_monthly_rate?: number | null } =
    {}
  if (parsed.data.name !== undefined) payload.name = parsed.data.name.trim()
  if (parsed.data.defaultNightlyRate !== undefined) {
    payload.default_nightly_rate = parsed.data.defaultNightlyRate
  }
  if (parsed.data.defaultMonthlyRate !== undefined) {
    payload.default_monthly_rate =
      parsed.data.defaultMonthlyRate === '' ? null : parsed.data.defaultMonthlyRate
  }

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

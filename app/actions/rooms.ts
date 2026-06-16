'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createRoomSchema, updateRoomSchema } from '@/lib/validations'
import type { DbRoomStatus } from '@/types'

export type RoomActionResult = { success: true } | { success: false; error: string }

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

function revalidateRoomViews() {
  revalidatePath('/owner/rooms')
  revalidatePath('/manager/rooms')
  revalidatePath('/owner/dashboard')
  revalidatePath('/manager/dashboard')
}

async function categoryBelongsToHotel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  categoryId: string,
  hotelId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('room_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('hotel_id', hotelId)
    .maybeSingle()
  return Boolean(data)
}

export async function createRoom(input: {
  number: string
  floor: number
  categoryId: string
  nightlyRate: number
  monthlyRate?: number | ''
}): Promise<RoomActionResult> {
  const parsed = createRoomSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  if (!(await categoryBelongsToHotel(supabase, parsed.data.categoryId, profile.hotel_id))) {
    return { success: false, error: 'Invalid room category.' }
  }

  const monthlyRate =
    parsed.data.monthlyRate === '' || parsed.data.monthlyRate === undefined
      ? null
      : parsed.data.monthlyRate

  const { error } = await supabase.from('rooms').insert({
    hotel_id: profile.hotel_id,
    number: parsed.data.number.trim(),
    floor: parsed.data.floor,
    category_id: parsed.data.categoryId,
    nightly_rate: parsed.data.nightlyRate,
    monthly_rate: monthlyRate,
    status: 'available',
    updated_by: profile.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'A room with that number already exists.' }
    return { success: false, error: error.message }
  }

  revalidateRoomViews()
  return { success: true }
}

export async function updateRoom(
  id: string,
  input: {
    number?: string
    floor?: number
    categoryId?: string
    nightlyRate?: number
    monthlyRate?: number | ''
    status?: DbRoomStatus
  },
): Promise<RoomActionResult> {
  const parsed = updateRoomSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }

  if (
    parsed.data.categoryId &&
    !(await categoryBelongsToHotel(supabase, parsed.data.categoryId, profile.hotel_id))
  ) {
    return { success: false, error: 'Invalid room category.' }
  }

  const payload: {
    number?: string
    floor?: number
    category_id?: string
    nightly_rate?: number
    monthly_rate?: number | null
    status?: DbRoomStatus
    updated_by: string
    updated_at: string
  } = { updated_by: profile.id, updated_at: new Date().toISOString() }

  if (parsed.data.number !== undefined) payload.number = parsed.data.number.trim()
  if (parsed.data.floor !== undefined) payload.floor = parsed.data.floor
  if (parsed.data.categoryId !== undefined) payload.category_id = parsed.data.categoryId
  if (parsed.data.nightlyRate !== undefined) payload.nightly_rate = parsed.data.nightlyRate
  if (parsed.data.monthlyRate !== undefined) {
    payload.monthly_rate = parsed.data.monthlyRate === '' ? null : parsed.data.monthlyRate
  }
  if (parsed.data.status !== undefined) payload.status = parsed.data.status

  const { error } = await supabase
    .from('rooms')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'A room with that number already exists.' }
    return { success: false, error: error.message }
  }

  revalidateRoomViews()
  return { success: true }
}

/** Status-only update — used by front-desk roles that cannot edit prices/inventory. */
export async function updateRoomStatus(
  id: string,
  status: DbRoomStatus,
): Promise<RoomActionResult> {
  const validStatuses: DbRoomStatus[] = [
    'available',
    'occupied',
    'cleaning',
    'needs_inspection',
    'maintenance',
  ]
  if (!validStatuses.includes(status)) {
    return { success: false, error: 'Invalid room status.' }
  }

  const { supabase, profile } = await requireStaff()
  if (
    !profile ||
    !['owner', 'manager', 'receptionist'].includes(profile.role) ||
    !profile.hotel_id
  ) {
    return { success: false, error: 'Not authorized.' }
  }

  const { error } = await supabase
    .from('rooms')
    .update({ status, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  revalidateRoomViews()
  revalidatePath('/receptionist/rooms')
  revalidatePath('/receptionist/dashboard')
  return { success: true }
}

export async function deleteRoom(id: string): Promise<RoomActionResult> {
  const { supabase, profile } = await requireStaff()
  if (!profile || profile.role !== 'owner') {
    return { success: false, error: 'Only owners can delete rooms.' }
  }

  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateRoomViews()
  return { success: true }
}

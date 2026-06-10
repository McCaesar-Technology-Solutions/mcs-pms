'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { DbRoomStatus, DbRoomType } from '@/types'

export type RoomActionResult = { success: true } | { success: false; error: string }

const VALID_STATUSES: DbRoomStatus[] = [
  'available',
  'occupied',
  'maintenance',
  'needs_inspection',
  'cleaning',
]
const VALID_TYPES: DbRoomType[] = ['standard', 'deluxe', 'suite']

async function requireManager() {
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

export async function createRoom(input: {
  number: string
  floor: number
  type: DbRoomType
}): Promise<RoomActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Not authorized.' }
  }
  if (!input.number.trim()) return { success: false, error: 'Room number is required.' }
  if (!VALID_TYPES.includes(input.type)) return { success: false, error: 'Invalid room type.' }

  const { error } = await supabase.from('rooms').insert({
    hotel_id: profile.hotel_id,
    number: input.number.trim(),
    floor: input.floor,
    type: input.type,
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
  input: { number?: string; floor?: number; type?: DbRoomType; status?: DbRoomStatus },
): Promise<RoomActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    return { success: false, error: 'Not authorized.' }
  }

  const payload: {
    number?: string
    floor?: number
    type?: DbRoomType
    status?: DbRoomStatus
    updated_by: string
    updated_at: string
  } = { updated_by: profile.id, updated_at: new Date().toISOString() }
  if (input.number !== undefined) {
    if (!input.number.trim()) return { success: false, error: 'Room number is required.' }
    payload.number = input.number.trim()
  }
  if (input.floor !== undefined) payload.floor = input.floor
  if (input.type !== undefined) {
    if (!VALID_TYPES.includes(input.type)) return { success: false, error: 'Invalid room type.' }
    payload.type = input.type
  }
  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status)) return { success: false, error: 'Invalid status.' }
    payload.status = input.status
  }

  const { error } = await supabase.from('rooms').update(payload).eq('id', id)
  if (error) {
    if (error.code === '23505') return { success: false, error: 'A room with that number already exists.' }
    return { success: false, error: error.message }
  }

  revalidateRoomViews()
  return { success: true }
}

export async function deleteRoom(id: string): Promise<RoomActionResult> {
  const { supabase, profile } = await requireManager()
  if (!profile || profile.role !== 'owner') {
    return { success: false, error: 'Only owners can delete rooms.' }
  }

  const { error } = await supabase.from('rooms').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidateRoomViews()
  return { success: true }
}

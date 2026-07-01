'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireVerifiedStaff } from '@/lib/auth/staff-session'
import { createRoomSchema, updateRoomSchema } from '@/lib/validations'
import { writeAuditLog, moneyDelta, logRoomStatusChange } from '@/lib/audit/log'
import {
  ROOM_IMAGE_BUCKET,
  roomImagePublicUrl,
  roomImageStoragePath,
} from '@/lib/rooms/image-storage'
import type { DbRoomStatus } from '@/types'
import { runNotifyTask } from '@/lib/notifications/notify-task'

export type RoomActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

async function requireStaff() {
  const result = await requireVerifiedStaff()
  if (!result.ok) return { supabase: result.supabase, profile: null }
  return { supabase: result.supabase, profile: result.profile }
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

  const { data: category } = await supabase
    .from('room_categories')
    .select('name')
    .eq('id', parsed.data.categoryId)
    .maybeSingle()

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

  if (profile.role === 'manager') {
    void import('@/lib/notifications/rooms').then(({ notifyOwnerRoomCreated }) =>
      runNotifyTask(
        notifyOwnerRoomCreated({
          hotelId: profile.hotel_id!,
          roomNumber: parsed.data.number.trim(),
          managerName: profile.name,
          floor: parsed.data.floor,
          nightlyRate: parsed.data.nightlyRate,
          categoryName: category?.name ?? null,
        }),
        {
          templateKey: 'room_created',
          hotelId: profile.hotel_id!,
        },
      ),
    )

    void writeAuditLog({
      hotelId: profile.hotel_id,
      actorId: profile.id,
      actorName: profile.name,
      entityType: 'room',
      entityId: null,
      action: 'created',
      summary: `Room ${parsed.data.number.trim()} added (floor ${parsed.data.floor})`,
    })
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

  const { data: existing } = await supabase
    .from('rooms')
    .select('number, nightly_rate, monthly_rate, status')
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  const { error } = await supabase
    .from('rooms')
    .update(payload)
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'A room with that number already exists.' }
    return { success: false, error: error.message }
  }

  if (existing) {
    const roomLabel = `Room ${existing.number}`
    const changes: string[] = []
    if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
      changes.push(`Status: ${existing.status} → ${parsed.data.status}`)
    }
    const nightlyDelta = moneyDelta(
      'Nightly rate',
      existing.nightly_rate,
      parsed.data.nightlyRate ?? Number(existing.nightly_rate ?? 0),
    )
    if (nightlyDelta) changes.push(nightlyDelta)
    if (parsed.data.monthlyRate !== undefined) {
      const nextMonthly =
        parsed.data.monthlyRate === '' ? 0 : Number(parsed.data.monthlyRate ?? 0)
      const monthlyDelta = moneyDelta('Monthly rate', existing.monthly_rate, nextMonthly)
      if (monthlyDelta) changes.push(monthlyDelta)
    }

    if (changes.length > 0) {
      void writeAuditLog({
        hotelId: profile.hotel_id!,
        actorId: profile.id,
        actorName: profile.name,
        entityType: 'room',
        entityId: id,
        action: 'updated',
        summary: `${roomLabel}: ${changes.join('; ')}`,
      })
    }
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

  const { data: existing } = await supabase
    .from('rooms')
    .select('number, status')
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  const { error } = await supabase
    .from('rooms')
    .update({ status, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hotel_id', profile.hotel_id)

  if (error) return { success: false, error: error.message }

  if (existing && existing.status !== status) {
    void logRoomStatusChange({
      hotelId: profile.hotel_id,
      actorId: profile.id,
      actorName: profile.name,
      roomId: id,
      roomNumber: existing.number,
      from: existing.status ?? 'available',
      to: status,
      reason: 'manual update',
    })
  }

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

export async function uploadRoomProfileImage(
  roomId: string,
  formData: FormData,
): Promise<RoomActionResult<{ imageUrl: string }>> {
  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Only owners and managers can upload room photos.' }
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return { success: false, error: 'No image file provided.' }
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return { success: false, error: 'Use JPEG, PNG, or WebP.' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Image must be 5 MB or smaller.' }
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('id, profile_image_path')
    .eq('id', roomId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!room) return { success: false, error: 'Room not found.' }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = roomImageStoragePath(profile.hotel_id, roomId, ext)
  const buffer = Buffer.from(await file.arrayBuffer())
  const admin = createAdminClient()

  const { error: uploadError } = await admin.storage.from(ROOM_IMAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) {
    return { success: false, error: uploadError.message ?? 'Could not upload image.' }
  }

  const { error: updateError } = await admin
    .from('rooms')
    .update({ profile_image_path: path, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('hotel_id', profile.hotel_id)

  if (updateError) {
    await admin.storage.from(ROOM_IMAGE_BUCKET).remove([path])
    return { success: false, error: updateError.message }
  }

  if (room.profile_image_path && room.profile_image_path !== path) {
    await admin.storage.from(ROOM_IMAGE_BUCKET).remove([room.profile_image_path])
  }

  revalidateRoomViews()
  return { success: true, data: { imageUrl: roomImagePublicUrl(path) ?? '' } }
}

export async function clearRoomProfileImage(roomId: string): Promise<RoomActionResult> {
  const { supabase, profile } = await requireStaff()
  if (!profile || !['owner', 'manager'].includes(profile.role) || !profile.hotel_id) {
    return { success: false, error: 'Only owners and managers can remove room photos.' }
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('profile_image_path')
    .eq('id', roomId)
    .eq('hotel_id', profile.hotel_id)
    .maybeSingle()

  if (!room?.profile_image_path) return { success: true }

  const admin = createAdminClient()
  await admin.storage.from(ROOM_IMAGE_BUCKET).remove([room.profile_image_path])
  await admin
    .from('rooms')
    .update({
      profile_image_path: null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .eq('hotel_id', profile.hotel_id)

  revalidateRoomViews()
  return { success: true }
}

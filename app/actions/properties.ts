'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureGuestPortalSlug } from '@/lib/guest-portal'
import { ensureDefaultGuestRules } from '@/lib/data/guest-rules'
import { seedDefaultRoomCategories } from '@/lib/data/room-categories'
import { getOwnerProperties, ownerOwnsHotel } from '@/lib/data/properties'
import { createPropertySchema } from '@/lib/validations'
import {
  PROPERTY_IMAGE_BUCKET,
  propertyImagePublicUrl,
  propertyImageStoragePath,
} from '@/lib/properties/image-storage'
import type { Property } from '@/types'

export type PropertyActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

function revalidateOwnerViews() {
  const paths = [
    '/owner/dashboard',
    '/owner/rooms',
    '/owner/reservations',
    '/owner/staff',
    '/owner/billing',
    '/owner/analytics',
    '/owner/channels',
    '/owner/gra-reports',
    '/owner/settings',
    '/owner/guests',
  ]
  for (const path of paths) revalidatePath(path)
}

async function requireOwner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null, userId: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, hotel_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner') {
    return { supabase, profile: null, userId: user.id }
  }

  return { supabase, profile, userId: user.id }
}

function propertyCode(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'MOJO'
  )
}

async function seedRooms(hotelId: string, totalRooms: number, ownerId: string) {
  const admin = createAdminClient()
  const standardCategoryId = await seedDefaultRoomCategories(admin, hotelId)
  if (!standardCategoryId) {
    throw new Error('Could not create default room categories.')
  }

  const { data: standardCategory } = await admin
    .from('room_categories')
    .select('id, default_nightly_rate')
    .eq('hotel_id', hotelId)
    .eq('name', 'Standard')
    .maybeSingle()

  const categoryId = standardCategory?.id ?? standardCategoryId
  const nightlyRate = Number(standardCategory?.default_nightly_rate ?? 250)

  const rooms = Array.from({ length: totalRooms }, (_, i) => ({
    hotel_id: hotelId,
    number: String(i + 1),
    floor: 1,
    category_id: categoryId,
    nightly_rate: nightlyRate,
    status: 'available' as const,
    updated_by: ownerId,
  }))
  const { error } = await admin.from('rooms').insert(rooms)
  if (error) throw new Error(error.message)
}

export async function fetchOwnerProperties(): Promise<PropertyActionResult<Property[]>> {
  const properties = await getOwnerProperties()
  return { success: true, data: properties }
}

export async function createProperty(input: {
  name: string
  address: string
  city: string
  region: string
  totalRooms: number
}): Promise<PropertyActionResult<Property>> {
  const parsed = createPropertySchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' }
  }

  const { profile, userId } = await requireOwner()
  if (!profile || !userId) return { success: false, error: 'Only owners can add properties.' }

  const admin = createAdminClient()

  const { data: hotel, error: hotelError } = await admin
    .from('hotels')
    .insert({
      name: parsed.data.name.trim(),
      address: parsed.data.address.trim(),
      city: parsed.data.city.trim(),
      region: parsed.data.region.trim(),
      owner_id: userId,
    })
    .select('id, name, address, city, region')
    .single()

  if (hotelError || !hotel) {
    return { success: false, error: hotelError?.message ?? 'Could not create property.' }
  }

  await ensureGuestPortalSlug(hotel.id)
  await ensureDefaultGuestRules(hotel.id)

  try {
    await seedRooms(hotel.id, parsed.data.totalRooms, userId)
  } catch (e) {
    await admin.from('hotels').delete().eq('id', hotel.id)
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Could not create rooms for this property.',
    }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ hotel_id: hotel.id })
    .eq('id', userId)

  if (profileError) {
    await admin.from('rooms').delete().eq('hotel_id', hotel.id)
    await admin.from('hotels').delete().eq('id', hotel.id)
    return { success: false, error: 'Property created but could not activate it.' }
  }

  revalidateOwnerViews()

  const { count: roomCount } = await admin
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('hotel_id', hotel.id)

  const property: Property = {
    id: hotel.id,
    name: hotel.name,
    code: propertyCode(hotel.name),
    address: hotel.address ?? '',
    city: hotel.city ?? parsed.data.city,
    region: hotel.region ?? parsed.data.region,
    totalRooms: roomCount ?? 0,
    imageUrl: null,
  }

  return { success: true, data: property }
}

export async function uploadPropertyProfileImage(
  hotelId: string,
  formData: FormData,
): Promise<PropertyActionResult<{ imageUrl: string }>> {
  const { profile, userId } = await requireOwner()
  if (!profile || !userId) return { success: false, error: 'Only owners can upload property images.' }

  if (!(await ownerOwnsHotel(userId, hotelId))) {
    return { success: false, error: 'You do not have access to this property.' }
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

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = propertyImageStoragePath(hotelId, ext)
  const buffer = Buffer.from(await file.arrayBuffer())

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('hotels')
    .select('profile_image_path')
    .eq('id', hotelId)
    .maybeSingle()

  const { error: uploadError } = await admin.storage.from(PROPERTY_IMAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) {
    return { success: false, error: uploadError.message ?? 'Could not upload image.' }
  }

  const { error: updateError } = await admin
    .from('hotels')
    .update({ profile_image_path: path })
    .eq('id', hotelId)

  if (updateError) {
    await admin.storage.from(PROPERTY_IMAGE_BUCKET).remove([path])
    return { success: false, error: updateError.message }
  }

  if (existing?.profile_image_path && existing.profile_image_path !== path) {
    await admin.storage.from(PROPERTY_IMAGE_BUCKET).remove([existing.profile_image_path])
  }

  revalidateOwnerViews()
  return { success: true, data: { imageUrl: propertyImagePublicUrl(path) ?? '' } }
}

export async function clearPropertyProfileImage(
  hotelId: string,
): Promise<PropertyActionResult> {
  const { profile, userId } = await requireOwner()
  if (!profile || !userId) return { success: false, error: 'Only owners can update property images.' }

  if (!(await ownerOwnsHotel(userId, hotelId))) {
    return { success: false, error: 'You do not have access to this property.' }
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('hotels')
    .select('profile_image_path')
    .eq('id', hotelId)
    .maybeSingle()

  const { error: updateError } = await admin
    .from('hotels')
    .update({ profile_image_path: null })
    .eq('id', hotelId)

  if (updateError) return { success: false, error: updateError.message }

  if (existing?.profile_image_path) {
    await admin.storage.from(PROPERTY_IMAGE_BUCKET).remove([existing.profile_image_path])
  }

  revalidateOwnerViews()
  return { success: true }
}

export async function switchActiveProperty(hotelId: string): Promise<PropertyActionResult> {
  const { profile, userId } = await requireOwner()
  if (!profile || !userId) return { success: false, error: 'Not authorized.' }

  if (!(await ownerOwnsHotel(userId, hotelId))) {
    return { success: false, error: 'You do not have access to that property.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ hotel_id: hotelId }).eq('id', userId)

  if (error) return { success: false, error: 'Could not switch property.' }

  revalidateOwnerViews()
  return { success: true }
}

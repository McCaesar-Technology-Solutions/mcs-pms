'use server'

import { revalidatePath } from 'next/cache'
import { loadVerifiedStaffProfile, consumeStaffAuthError } from '@/lib/auth/staff-session'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGuestFromSession } from '@/app/actions/guest'
import {
  PROFILE_PHOTO_BUCKET,
  guestProfileStoragePath,
  profilePhotoPublicUrl,
  staffProfileStoragePath,
} from '@/lib/profile-photos/storage'

export type ProfilePhotoActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

function fileExt(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

function revalidateProfilePhotoViews() {
  revalidatePath('/guest')
  revalidatePath('/owner/settings')
  revalidatePath('/owner/messages')
  revalidatePath('/manager/messages')
  revalidatePath('/receptionist/messages')
  revalidatePath('/technician/messages')
  revalidatePath('/technician')
}

async function requireAuthenticatedProfile() {
  const profile = await loadVerifiedStaffProfile()
  if (!profile?.hotel_id) return null
  return profile
}

export async function uploadMyProfilePhoto(
  formData: FormData,
): Promise<ProfilePhotoActionResult<{ imageUrl: string }>> {
  const profile = await requireAuthenticatedProfile()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return { success: false, error: 'No image file provided.' }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Use JPEG, PNG, or WebP.' }
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: 'Image must be 5 MB or smaller.' }
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('profile_image_path')
    .eq('id', profile.id)
    .maybeSingle()

  const path = staffProfileStoragePath(profile.hotel_id!, profile.id, fileExt(file.type))
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage.from(PROFILE_PHOTO_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    return { success: false, error: uploadError.message ?? 'Could not upload image.' }
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ profile_image_path: path })
    .eq('id', profile.id)

  if (updateError) {
    await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([path])
    return { success: false, error: updateError.message ?? 'Could not save photo.' }
  }

  if (existing?.profile_image_path && existing.profile_image_path !== path) {
    await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([existing.profile_image_path])
  }

  revalidateProfilePhotoViews()
  return { success: true, data: { imageUrl: profilePhotoPublicUrl(path) ?? '' } }
}

export async function clearMyProfilePhoto(): Promise<ProfilePhotoActionResult> {
  const profile = await requireAuthenticatedProfile()
  if (!profile) return { success: false, error: 'Not authorized.' }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('profiles')
    .select('profile_image_path')
    .eq('id', profile.id)
    .maybeSingle()

  if (!existing?.profile_image_path) return { success: true }

  await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([existing.profile_image_path])
  await admin.from('profiles').update({ profile_image_path: null }).eq('id', profile.id)

  revalidateProfilePhotoViews()
  return { success: true }
}

export async function uploadGuestProfilePhoto(
  formData: FormData,
): Promise<ProfilePhotoActionResult<{ imageUrl: string }>> {
  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return {
      success: false,
      error: !session.success ? (session.error ?? 'Session expired.') : 'Session expired.',
    }
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return { success: false, error: 'No image file provided.' }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'Use JPEG, PNG, or WebP.' }
  }
  if (file.size > MAX_BYTES) {
    return { success: false, error: 'Image must be 5 MB or smaller.' }
  }

  const { guest } = session.data
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('guests')
    .select('profile_image_path')
    .eq('id', guest.id)
    .maybeSingle()

  const path = guestProfileStoragePath(guest.hotel_id, guest.id, fileExt(file.type))
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage.from(PROFILE_PHOTO_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (uploadError) {
    return { success: false, error: uploadError.message ?? 'Could not upload image.' }
  }

  const { error: updateError } = await admin
    .from('guests')
    .update({ profile_image_path: path })
    .eq('id', guest.id)

  if (updateError) {
    await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([path])
    return { success: false, error: updateError.message ?? 'Could not save photo.' }
  }

  if (existing?.profile_image_path && existing.profile_image_path !== path) {
    await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([existing.profile_image_path])
  }

  revalidateProfilePhotoViews()
  return { success: true, data: { imageUrl: profilePhotoPublicUrl(path) ?? '' } }
}

export async function clearGuestProfilePhoto(): Promise<ProfilePhotoActionResult> {
  const session = await getGuestFromSession()
  if (!session.success || !session.data) {
    return {
      success: false,
      error: !session.success ? (session.error ?? 'Session expired.') : 'Session expired.',
    }
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('guests')
    .select('profile_image_path')
    .eq('id', session.data.guest.id)
    .maybeSingle()

  if (!existing?.profile_image_path) return { success: true }

  await admin.storage.from(PROFILE_PHOTO_BUCKET).remove([existing.profile_image_path])
  await admin
    .from('guests')
    .update({ profile_image_path: null })
    .eq('id', session.data.guest.id)

  revalidateProfilePhotoViews()
  return { success: true }
}

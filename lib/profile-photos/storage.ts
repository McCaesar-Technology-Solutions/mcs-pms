import { PROPERTY_IMAGE_BUCKET } from '@/lib/properties/image-storage'

export { PROPERTY_IMAGE_BUCKET as PROFILE_PHOTO_BUCKET }

export function staffProfileStoragePath(hotelId: string, profileId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${hotelId}/profiles/staff/${profileId}-${Date.now()}.${safeExt}`
}

export function guestProfileStoragePath(hotelId: string, guestId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${hotelId}/profiles/guests/${guestId}-${Date.now()}.${safeExt}`
}

export function profilePhotoPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${PROPERTY_IMAGE_BUCKET}/${path}`
}

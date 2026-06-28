import { PROPERTY_IMAGE_BUCKET } from '@/lib/properties/image-storage'

export { PROPERTY_IMAGE_BUCKET as ROOM_IMAGE_BUCKET }

export function roomImageStoragePath(hotelId: string, roomId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${hotelId}/rooms/${roomId}-${Date.now()}.${safeExt}`
}

export function roomImagePublicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${PROPERTY_IMAGE_BUCKET}/${path}`
}

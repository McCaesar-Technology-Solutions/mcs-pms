export const PROPERTY_IMAGE_BUCKET = 'property-images'

export function propertyImageStoragePath(hotelId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${hotelId}/profile-${Date.now()}.${safeExt}`
}

export function propertyImagePublicUrl(path: string | null | undefined): string | null {
  if (!path) return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  return `${base}/storage/v1/object/public/${PROPERTY_IMAGE_BUCKET}/${path}`
}

import { createAdminClient } from '@/lib/supabase/admin'

export const GUEST_ID_DOCUMENT_BUCKET = 'guest-id-documents'

const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const MAX_BYTES = 5 * 1024 * 1024

export function guestIdDocumentMime(file: File): string | null {
  if (!ALLOWED_MIMES.has(file.type)) return null
  if (file.size > MAX_BYTES) return null
  return file.type
}

export async function uploadGuestIdDocument(
  guestId: string,
  hotelId: string,
  file: File,
): Promise<{ path: string; mime: string } | null> {
  const mime = guestIdDocumentMime(file)
  if (!mime) return null

  const ext =
    mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const path = `${hotelId}/${guestId}/id-${Date.now()}.${ext}`

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from(GUEST_ID_DOCUMENT_BUCKET).upload(path, buffer, {
    contentType: mime,
    upsert: true,
  })

  if (error) return null
  return { path, mime }
}

export const GUEST_COMPLAINT_PHOTO_BUCKET = 'guest-complaint-photos'

const UPLOAD_TIMEOUT_MS = 12_000

export function guestComplaintPhotoPath(hotelId: string, complaintId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${hotelId}/${complaintId}.${safeExt}`
}

export function guestComplaintPhotoMime(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  return allowed.includes(file.type) ? file.type : null
}

/** Upload guest complaint photo — non-fatal if storage or columns are unavailable. */
export async function uploadGuestComplaintPhoto(
  hotelId: string,
  complaintId: string,
  buffer: Buffer,
  mime: string,
): Promise<void> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const ext = mime.split('/')[1] ?? 'jpg'
  const path = guestComplaintPhotoPath(hotelId, complaintId, ext)

  const upload = admin.storage
    .from(GUEST_COMPLAINT_PHOTO_BUCKET)
    .upload(path, buffer, { contentType: mime, upsert: true })

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Photo upload timed out')), UPLOAD_TIMEOUT_MS)
  })

  const { error: uploadError } = await Promise.race([upload, timeout])
  if (uploadError) return

  await admin
    .from('complaints')
    .update({ guest_photo_path: path, guest_photo_mime: mime })
    .eq('id', complaintId)
}

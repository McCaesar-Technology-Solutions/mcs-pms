export const GUEST_COMPLAINT_PHOTO_BUCKET = 'guest-complaint-photos'

export function guestComplaintPhotoPath(hotelId: string, complaintId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg'
  return `${hotelId}/${complaintId}.${safeExt}`
}

export function guestComplaintPhotoMime(file: File): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  return allowed.includes(file.type) ? file.type : null
}

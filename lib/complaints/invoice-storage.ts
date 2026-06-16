export const COMPLAINT_INVOICE_BUCKET = 'complaint-invoices'

export const INVOICE_MAX_BYTES = 10 * 1024 * 1024

export const INVOICE_ALLOWED_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function invoiceFileExtension(mime: string): string | null {
  return INVOICE_ALLOWED_MIME[mime] ?? null
}

/** One invoice file per complaint: {hotelId}/{complaintId}/invoice.{ext} */
export function invoiceStoragePath(hotelId: string, complaintId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
  return `${hotelId}/${complaintId}/invoice.${safeExt}`
}

export function sanitizeDownloadFilename(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim()
  return base.slice(0, 200) || 'invoice'
}

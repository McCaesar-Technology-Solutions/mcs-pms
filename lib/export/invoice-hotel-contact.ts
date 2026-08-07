import type { ExportHotelInfo } from '@/lib/export/types'

/** Canonical MOJO invoice letterhead contact. */
export const INVOICE_CONTACT_DEFAULTS = {
  address: 'P. O. Box KB 814, Korle-bu, Accra – Ghana',
  location: 'Plot N0. C 94A Community 26, TDC. Kpone, Tema',
  phone: '+233 20 849 1988',
  email: 'mojoapartment26@gmail.com',
} as const

/** Apply the property invoice letterhead contact block. */
export function withInvoiceHotelContact(hotel: ExportHotelInfo): ExportHotelInfo {
  return {
    ...hotel,
    address: INVOICE_CONTACT_DEFAULTS.address,
    location: INVOICE_CONTACT_DEFAULTS.location,
    phone: INVOICE_CONTACT_DEFAULTS.phone,
    email: INVOICE_CONTACT_DEFAULTS.email,
  }
}

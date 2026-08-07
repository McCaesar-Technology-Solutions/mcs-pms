export interface ExportHotelInfo {
  name: string
  /** Postal / mailing address shown on invoices. */
  address: string | null
  /** Physical site / plot location shown on invoices. */
  location?: string | null
  city: string | null
  region: string | null
  phone?: string | null
  email?: string | null
  vatRegistrationNumber: string | null
  vatMode?: 'exclusive' | 'inclusive'
}

export interface InvoiceExportRow {
  invoiceNumber: string
  guestName: string
  guestPhone?: string | null
  roomNumber: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  issuedAt: string | null
  subtotal: number
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  total: number
  paymentMethod: string | null
  paymentStatus: string | null
}

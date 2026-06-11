export interface ExportHotelInfo {
  name: string
  address: string | null
  city: string | null
  region: string | null
  vatRegistrationNumber: string | null
}

export interface InvoiceExportRow {
  invoiceNumber: string
  guestName: string
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

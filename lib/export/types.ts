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
  /** Payer on BILL TO when different from the stay guest. */
  billToName?: string | null
  guestPhone?: string | null
  /** Hotel GRA Tax ID snapshot (not the guest’s ID document). */
  guestTaxId?: string | null
  roomNumber: string | null
  /** Frozen room category at issue (e.g. Deluxe). */
  roomCategoryName?: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  issuedAt: string | null
  /** Taxable accommodation / services after discount. */
  subtotal: number
  /** Pre-tax discount snapshot (GHS). */
  discountAmount?: number
  discountReason?: string | null
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  tourism?: number
  /** Frozen rates at issue (fractions). Used for PDF labels. */
  taxSnapshot?: {
    nhil: number
    getfund: number
    covid: number
    vat: number
    elevy: number
    tourism: number
  } | null
  total: number
  /** Amount already paid toward this invoice (for Balance on PDF). */
  amountPaid?: number
  paymentMethod: string | null
  paymentStatus: string | null
}

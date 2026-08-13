// Ghana Revenue Authority (GRA) indirect tax rates for hospitality.
// Confirm COVID Health Recovery Levy applicability with your tax advisor — set
// GRA_COVID_LEVY_RATE=0 on Vercel if your property class no longer applies it.
// Per-hotel overrides live on hotels.tax_*_rate (null = these defaults).

function covidLevyRate(): number {
  const raw = process.env.GRA_COVID_LEVY_RATE?.trim()
  if (raw === '0' || raw === 'false') return 0
  if (raw) {
    const n = Number(raw)
    if (!Number.isNaN(n) && n >= 0) return n
  }
  return 0.01
}

export const GRA_RATES = {
  nhil: 0.025,
  getfund: 0.025,
  get covid() {
    return covidLevyRate()
  },
  vat: 0.15,
  elevy: 0,
} as const

export type VatMode = 'exclusive' | 'inclusive'

/** Resolved fractions used for a calculation (0–1). */
export interface HotelTaxRates {
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  /** Tourism levy — applied on taxable base; not inside NHIL/GETFund/VAT base. */
  tourism: number
}

export type TaxSnapshot = HotelTaxRates & { [key: string]: number }

/** System defaults. Tourism is 0 until a hotel explicitly enables it. */
export function defaultHotelTaxRates(): HotelTaxRates {
  return {
    nhil: GRA_RATES.nhil,
    getfund: GRA_RATES.getfund,
    covid: GRA_RATES.covid,
    vat: GRA_RATES.vat,
    elevy: GRA_RATES.elevy,
    tourism: 0,
  }
}

export function resolveHotelTaxRates(input: {
  tax_nhil_rate?: number | null
  tax_getfund_rate?: number | null
  tax_vat_rate?: number | null
  tax_elevy_rate?: number | null
  tax_covid_rate?: number | null
  tax_tourism_levy_rate?: number | null
} | null | undefined): HotelTaxRates {
  const defaults = defaultHotelTaxRates()
  if (!input) return defaults
  return {
    nhil: input.tax_nhil_rate != null ? Number(input.tax_nhil_rate) : defaults.nhil,
    getfund: input.tax_getfund_rate != null ? Number(input.tax_getfund_rate) : defaults.getfund,
    covid: input.tax_covid_rate != null ? Number(input.tax_covid_rate) : defaults.covid,
    vat: input.tax_vat_rate != null ? Number(input.tax_vat_rate) : defaults.vat,
    elevy: input.tax_elevy_rate != null ? Number(input.tax_elevy_rate) : defaults.elevy,
    tourism:
      input.tax_tourism_levy_rate != null
        ? Number(input.tax_tourism_levy_rate)
        : defaults.tourism,
  }
}

/** Multiplier from pre-tax base to gross total (exclusive mode). */
export function graGrossMultiplier(rates: HotelTaxRates = defaultHotelTaxRates()): number {
  return (
    1 +
    rates.nhil +
    rates.getfund +
    rates.covid +
    rates.vat * (1 + rates.nhil + rates.getfund + rates.covid) +
    rates.elevy +
    rates.tourism
  )
}

/** @deprecated Use graGrossMultiplier() when rates may vary. */
export const GRA_GROSS_MULTIPLIER = graGrossMultiplier()

export interface InvoiceTaxes {
  subtotal: number
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  tourism: number
  total: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clampRate(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.min(1, value)
}

function taxesFromBase(base: number, rates: HotelTaxRates): InvoiceTaxes {
  const subtotal = Math.max(0, round2(base))
  const nhil = round2(subtotal * clampRate(rates.nhil))
  const getfund = round2(subtotal * clampRate(rates.getfund))
  const covid = round2(subtotal * clampRate(rates.covid))
  const vatable = subtotal + nhil + getfund + covid
  const vat = round2(vatable * clampRate(rates.vat))
  const elevy = round2(subtotal * clampRate(rates.elevy))
  // Tourism levy sits outside the VAT/NHIL/GETFund base (2026 practice).
  const tourism = round2(subtotal * clampRate(rates.tourism))
  const total = round2(subtotal + nhil + getfund + covid + vat + elevy + tourism)

  return { subtotal, nhil, getfund, covid, vat, elevy, tourism, total }
}

/** Invoice with no GRA levies — subtotal equals total. */
export function noTaxInvoice(amount: number): InvoiceTaxes {
  const subtotal = Math.max(0, round2(amount))
  return {
    subtotal,
    nhil: 0,
    getfund: 0,
    covid: 0,
    vat: 0,
    elevy: 0,
    tourism: 0,
    total: subtotal,
  }
}

/**
 * Compute GRA tax breakdown.
 * - exclusive: `amount` is pre-tax room/service charges; taxes are added.
 * - inclusive: `amount` is the gross total; taxes are extracted for the invoice.
 */
export function computeInvoiceTaxes(
  amount: number,
  mode: VatMode = 'exclusive',
  rates: HotelTaxRates = defaultHotelTaxRates(),
): InvoiceTaxes {
  const value = Math.max(0, round2(amount))

  if (mode === 'inclusive') {
    const gross = value
    const base = round2(gross / graGrossMultiplier(rates))
    const taxes = taxesFromBase(base, rates)
    const componentSum = round2(
      taxes.subtotal +
        taxes.nhil +
        taxes.getfund +
        taxes.covid +
        taxes.vat +
        taxes.elevy +
        taxes.tourism,
    )
    const vat = round2(taxes.vat + round2(gross - componentSum))
    return { ...taxes, vat, total: gross }
  }

  return taxesFromBase(value, rates)
}

export function computeInvoiceTaxesWithOption(
  amount: number,
  mode: VatMode,
  includeTax: boolean,
  rates: HotelTaxRates = defaultHotelTaxRates(),
): InvoiceTaxes {
  if (!includeTax) return noTaxInvoice(amount)
  return computeInvoiceTaxes(amount, mode, rates)
}

export function taxSnapshotFromRates(rates: HotelTaxRates): TaxSnapshot {
  return {
    nhil: clampRate(rates.nhil),
    getfund: clampRate(rates.getfund),
    covid: clampRate(rates.covid),
    vat: clampRate(rates.vat),
    elevy: clampRate(rates.elevy),
    tourism: clampRate(rates.tourism),
  }
}

export function parseTaxSnapshot(raw: unknown): HotelTaxRates | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (k: string) => {
    const v = Number(o[k])
    return Number.isFinite(v) ? v : null
  }
  const nhil = num('nhil')
  const getfund = num('getfund')
  const covid = num('covid')
  const vat = num('vat')
  const elevy = num('elevy')
  const tourism = num('tourism')
  if (
    nhil == null ||
    getfund == null ||
    covid == null ||
    vat == null ||
    elevy == null ||
    tourism == null
  ) {
    return null
  }
  return { nhil, getfund, covid, vat, elevy, tourism }
}

/**
 * Prefer a frozen invoice snapshot so rate edits mid-stay do not rewrite issued invoices.
 * First issue uses current hotel rates.
 */
export function resolveInvoiceTaxRates(
  existingSnapshot: unknown,
  hotelRates: HotelTaxRates,
): { rates: HotelTaxRates; snapshot: TaxSnapshot; frozen: boolean } {
  const frozen = parseTaxSnapshot(existingSnapshot)
  if (frozen) {
    return { rates: frozen, snapshot: taxSnapshotFromRates(frozen), frozen: true }
  }
  const snapshot = taxSnapshotFromRates(hotelRates)
  return { rates: hotelRates, snapshot, frozen: false }
}

export function formatTaxPercent(rate: number): string {
  const pct = round2(clampRate(rate) * 100)
  return Number.isInteger(pct) ? `${pct}%` : `${pct}%`
}

/** True when an invoice includes GRA levies (show tax breakdown in UI/PDF). */
export function invoiceHasTaxBreakdown(taxes: {
  nhil?: number | null
  getfund?: number | null
  covid?: number | null
  vat?: number | null
  elevy?: number | null
  tourism?: number | null
  nhil_amount?: number | null
  getfund_amount?: number | null
  covid_levy_amount?: number | null
  vat_amount?: number | null
  elevy_amount?: number | null
  tourism_levy_amount?: number | null
}): boolean {
  const nhil = Number(taxes.nhil ?? taxes.nhil_amount ?? 0)
  const getfund = Number(taxes.getfund ?? taxes.getfund_amount ?? 0)
  const covid = Number(taxes.covid ?? taxes.covid_levy_amount ?? 0)
  const vat = Number(taxes.vat ?? taxes.vat_amount ?? 0)
  const elevy = Number(taxes.elevy ?? taxes.elevy_amount ?? 0)
  const tourism = Number(taxes.tourism ?? taxes.tourism_levy_amount ?? 0)
  return nhil + getfund + covid + vat + elevy + tourism > 0.009
}

export const VAT_MODE_LABELS: Record<VatMode, string> = {
  exclusive: 'Taxes added at checkout',
  inclusive: 'Rates include VAT & levies',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  telecel_cash: 'Telecel Cash',
  airteltigo: 'AirtelTigo Money',
  visa: 'Visa',
  mastercard: 'Mastercard',
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
}

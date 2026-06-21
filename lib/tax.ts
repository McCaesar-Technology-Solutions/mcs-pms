// Ghana Revenue Authority (GRA) indirect tax rates for hospitality.
// Levies (NHIL, GETFund, COVID-19 Health Recovery Levy) are charged on the
// taxable value; VAT is then charged on the value INCLUSIVE of those levies.
// The E-Levy was abolished in 2025, so it is kept in the schema but rated 0.
export const GRA_RATES = {
  nhil: 0.025,
  getfund: 0.025,
  covid: 0.01,
  vat: 0.15,
  elevy: 0,
} as const

export type VatMode = 'exclusive' | 'inclusive'

/** Multiplier from pre-tax base to gross total (exclusive mode). */
export const GRA_GROSS_MULTIPLIER =
  1 +
  GRA_RATES.nhil +
  GRA_RATES.getfund +
  GRA_RATES.covid +
  GRA_RATES.vat * (1 + GRA_RATES.nhil + GRA_RATES.getfund + GRA_RATES.covid) +
  GRA_RATES.elevy

export interface InvoiceTaxes {
  subtotal: number
  nhil: number
  getfund: number
  covid: number
  vat: number
  elevy: number
  total: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function taxesFromBase(base: number): InvoiceTaxes {
  const subtotal = Math.max(0, round2(base))
  const nhil = round2(subtotal * GRA_RATES.nhil)
  const getfund = round2(subtotal * GRA_RATES.getfund)
  const covid = round2(subtotal * GRA_RATES.covid)
  const vatable = subtotal + nhil + getfund + covid
  const vat = round2(vatable * GRA_RATES.vat)
  const elevy = round2(subtotal * GRA_RATES.elevy)
  const total = round2(subtotal + nhil + getfund + covid + vat + elevy)

  return { subtotal, nhil, getfund, covid, vat, elevy, total }
}

/**
 * Compute GRA tax breakdown.
 * - exclusive: `amount` is pre-tax room/service charges; taxes are added.
 * - inclusive: `amount` is the gross total; taxes are extracted for the invoice.
 */
export function computeInvoiceTaxes(amount: number, mode: VatMode = 'exclusive'): InvoiceTaxes {
  const value = Math.max(0, round2(amount))

  if (mode === 'inclusive') {
    const gross = value
    const base = round2(gross / GRA_GROSS_MULTIPLIER)
    const taxes = taxesFromBase(base)
    const componentSum = round2(
      taxes.subtotal + taxes.nhil + taxes.getfund + taxes.covid + taxes.vat + taxes.elevy,
    )
    const vat = round2(taxes.vat + round2(gross - componentSum))
    return { ...taxes, vat, total: gross }
  }

  return taxesFromBase(value)
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

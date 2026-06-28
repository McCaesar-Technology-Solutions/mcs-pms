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
/** Invoice with no GRA levies — subtotal equals total. */
export function noTaxInvoice(amount: number): InvoiceTaxes {
  const subtotal = Math.max(0, round2(amount))
  return { subtotal, nhil: 0, getfund: 0, covid: 0, vat: 0, elevy: 0, total: subtotal }
}

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

export function computeInvoiceTaxesWithOption(
  amount: number,
  mode: VatMode,
  includeTax: boolean,
): InvoiceTaxes {
  if (!includeTax) return noTaxInvoice(amount)
  return computeInvoiceTaxes(amount, mode)
}

/** True when an invoice includes GRA levies (show tax breakdown in UI/PDF). */
export function invoiceHasTaxBreakdown(taxes: {
  nhil?: number | null
  getfund?: number | null
  covid?: number | null
  vat?: number | null
  elevy?: number | null
  nhil_amount?: number | null
  getfund_amount?: number | null
  covid_levy_amount?: number | null
  vat_amount?: number | null
  elevy_amount?: number | null
}): boolean {
  const nhil = Number(taxes.nhil ?? taxes.nhil_amount ?? 0)
  const getfund = Number(taxes.getfund ?? taxes.getfund_amount ?? 0)
  const covid = Number(taxes.covid ?? taxes.covid_levy_amount ?? 0)
  const vat = Number(taxes.vat ?? taxes.vat_amount ?? 0)
  const elevy = Number(taxes.elevy ?? taxes.elevy_amount ?? 0)
  return nhil + getfund + covid + vat + elevy > 0.009
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

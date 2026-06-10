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

export function computeInvoiceTaxes(subtotal: number): InvoiceTaxes {
  const base = Math.max(0, round2(subtotal))
  const nhil = round2(base * GRA_RATES.nhil)
  const getfund = round2(base * GRA_RATES.getfund)
  const covid = round2(base * GRA_RATES.covid)
  const vatable = base + nhil + getfund + covid
  const vat = round2(vatable * GRA_RATES.vat)
  const elevy = round2(base * GRA_RATES.elevy)
  const total = round2(base + nhil + getfund + covid + vat + elevy)

  return { subtotal: base, nhil, getfund, covid, vat, elevy, total }
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

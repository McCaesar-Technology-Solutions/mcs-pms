export type DiscountType = 'none' | 'percent' | 'fixed'

export interface StayDiscountInput {
  discountType?: DiscountType | string | null
  discountValue?: number | null
  discountReason?: string | null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function normalizeDiscountType(
  value: string | null | undefined,
): DiscountType {
  if (value === 'percent' || value === 'fixed') return value
  return 'none'
}

/** Compute GHS discount capped at the pre-tax base. */
export function computeDiscountAmount(
  base: number,
  type: DiscountType | string | null | undefined,
  value: number | null | undefined,
): number {
  const safeBase = Math.max(0, round2(base))
  const amount = Math.max(0, Number(value ?? 0))
  const kind = normalizeDiscountType(type)
  if (kind === 'none' || amount <= 0 || safeBase <= 0) return 0
  if (kind === 'percent') {
    const pct = Math.min(100, amount)
    return round2(Math.min(safeBase, (safeBase * pct) / 100))
  }
  return round2(Math.min(safeBase, amount))
}

export function applyDiscountToBase(
  base: number,
  type: DiscountType | string | null | undefined,
  value: number | null | undefined,
): { taxableBase: number; discountAmount: number } {
  const discountAmount = computeDiscountAmount(base, type, value)
  return {
    taxableBase: round2(Math.max(0, round2(base) - discountAmount)),
    discountAmount,
  }
}

export function discountLabel(
  type: DiscountType | string | null | undefined,
  value: number | null | undefined,
): string | null {
  const kind = normalizeDiscountType(type)
  const amount = Number(value ?? 0)
  if (kind === 'none' || amount <= 0) return null
  if (kind === 'percent') return `${amount}% off`
  return `₵${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} off`
}

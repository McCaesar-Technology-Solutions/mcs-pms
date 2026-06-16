import { stayNights } from '@/lib/stays/helpers'

export type RateType = 'nightly' | 'monthly'

const DAYS_PER_MONTH = 30

/** Stay total — monthly rates prorate daily (rate ÷ 30 × nights). */
export function calculateStayTotal(
  rateType: RateType,
  checkIn: string,
  checkOut: string,
  nightlyRate: number,
  monthlyRate: number,
): number {
  const nights = stayNights(checkIn, checkOut)
  if (rateType === 'monthly') {
    return roundMoney((monthlyRate / DAYS_PER_MONTH) * nights)
  }
  return roundMoney(nightlyRate * nights)
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function rateTypeLabel(rateType: RateType): string {
  return rateType === 'monthly' ? 'Monthly (prorated)' : 'Nightly'
}

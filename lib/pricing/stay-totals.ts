import { stayNights } from '@/lib/stays/helpers'

export type RateType = 'nightly' | 'weekly' | 'monthly'

const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30

/** Stay total — weekly/monthly rates prorate daily (rate ÷ 7 or ÷ 30 × nights). */
export function calculateStayTotal(
  rateType: RateType,
  checkIn: string,
  checkOut: string,
  nightlyRate: number,
  monthlyRate: number,
  weeklyRate = 0,
): number {
  const nights = stayNights(checkIn, checkOut)
  if (rateType === 'monthly') {
    return roundMoney((monthlyRate / DAYS_PER_MONTH) * nights)
  }
  if (rateType === 'weekly') {
    return roundMoney((weeklyRate / DAYS_PER_WEEK) * nights)
  }
  return roundMoney(nightlyRate * nights)
}

/** Daily equivalent used for one-night fees (no-show / overstay). */
export function dailyRateForType(
  rateType: RateType,
  nightlyRate: number,
  monthlyRate: number,
  weeklyRate = 0,
): number {
  if (rateType === 'monthly') return roundMoney(monthlyRate / DAYS_PER_MONTH)
  if (rateType === 'weekly') return roundMoney(weeklyRate / DAYS_PER_WEEK)
  return roundMoney(nightlyRate)
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function rateTypeLabel(rateType: RateType): string {
  if (rateType === 'monthly') return 'Monthly (prorated)'
  if (rateType === 'weekly') return 'Weekly (prorated)'
  return 'Nightly'
}

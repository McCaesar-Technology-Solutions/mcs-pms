import { phoneDigits } from '@/lib/phone'

/** Normalize Ghana numbers to E.164 (+233…). */
export function toE164(phone: string, countryCode = '233'): string {
  let digits = phoneDigits(phone)
  if (!digits) return ''

  if (digits.startsWith('0')) {
    digits = countryCode + digits.slice(1)
  } else if (digits.length <= 10 && !digits.startsWith(countryCode)) {
    digits = countryCode + digits
  }

  return digits.startsWith('+') ? digits : `+${digits}`
}

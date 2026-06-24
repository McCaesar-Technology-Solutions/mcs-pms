export const MFA_OTP_TTL_MS = 5 * 60 * 1000
export const MFA_SEND_COOLDOWN_MS = 60 * 1000
export const MFA_SEND_MAX_PER_15_MIN = 5

export { hashOtp, hashSessionKey } from '@/lib/auth/mfa-crypto'

/** Six-digit OTP using Web Crypto (Edge-safe). */
export function generateOtpCode(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(100_000 + (arr[0] % 900_000))
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  return `••• ••• ${digits.slice(-4)}`
}

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.indexOf('@')
  if (at <= 1) return trimmed
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at)
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'•'.repeat(Math.max(1, local.length - visible.length))}${domain}`
}

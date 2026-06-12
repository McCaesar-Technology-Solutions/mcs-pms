import { z } from 'zod'

export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((value) => value.replace(/\D/g, '').length >= 9, 'Enter a valid phone number')

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function hasPhoneNumber(phone: string | null | undefined): boolean {
  return Boolean(phone?.trim())
}

export function telHref(phone: string): string {
  const digits = phoneDigits(phone)
  return digits ? `tel:${digits}` : ''
}

export function whatsAppHref(phone: string, message?: string): string {
  const digits = phoneDigits(phone)
  if (!digits) return ''
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

import { createAdminClient } from '@/lib/supabase/admin'
import type { Guest } from '@/types'

export type GuestTokenValidation =
  | { ok: true; guest: Guest; roomNumber: string | null; expiresAt: Date }
  | { ok: false; error: string }

/** Validate a guest portal access token (shared by route handler + server actions). */
export async function validateGuestAccessToken(token: string): Promise<GuestTokenValidation> {
  if (!token?.trim()) {
    return { ok: false, error: 'Missing access token.' }
  }

  const admin = createAdminClient()
  const { data: guest, error } = await admin
    .from('guests')
    .select('*, rooms(number)')
    .eq('token', token.trim())
    .maybeSingle()

  if (error || !guest) {
    return { ok: false, error: 'Invalid or expired link.' }
  }

  if (guest.token_expires_at && new Date(guest.token_expires_at) <= new Date()) {
    return { ok: false, error: 'expired' }
  }

  const expiresAt = guest.token_expires_at
    ? new Date(guest.token_expires_at)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const roomNumber =
    guest.rooms && typeof guest.rooms === 'object' && 'number' in guest.rooms
      ? (guest.rooms as { number: string }).number
      : null

  return {
    ok: true,
    guest: guest as Guest,
    roomNumber,
    expiresAt,
  }
}

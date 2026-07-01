import { createAdminClient } from '@/lib/supabase/admin'

/** Authenticator apps are no longer supported — move legacy rows to SMS or disable. */
export async function migrateLegacyTotpMfa(userId: string): Promise<void> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('mfa_method, mfa_totp_secret, mfa_totp_pending_secret, phone, email')
    .eq('id', userId)
    .maybeSingle()

  if (!data) return
  const hasTotp =
    data.mfa_method === 'totp' ||
    Boolean(data.mfa_totp_secret?.trim()) ||
    Boolean(data.mfa_totp_pending_secret?.trim())
  if (!hasTotp) return

  const hasPhone = Boolean(data.phone?.trim())
  const hasEmail = Boolean(data.email?.trim())
  const useSms = hasPhone
  const useEmail = !hasPhone && hasEmail

  await admin
    .from('profiles')
    .update({
      mfa_enabled: useSms || useEmail,
      mfa_method: useSms ? 'sms' : useEmail ? 'email' : null,
      mfa_sms_enabled: useSms,
      mfa_totp_secret: null,
      mfa_totp_pending_secret: null,
    })
    .eq('id', userId)
}

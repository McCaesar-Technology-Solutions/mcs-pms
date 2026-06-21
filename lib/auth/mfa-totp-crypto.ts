/** Encrypt TOTP secrets at rest (AES-GCM, key derived from MFA_OTP_SECRET). */

function secretMaterial(): string {
  return (
    process.env.MFA_OTP_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'dev-only-mfa-secret-change-me'
  )
}

async function deriveAesKey(): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secretMaterial()))
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

export async function encryptTotpSecret(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey()
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return `${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`
}

export async function decryptTotpSecret(payload: string): Promise<string | null> {
  const [ivPart, cipherPart] = payload.split('.')
  if (!ivPart || !cipherPart) return null

  try {
    const key = await deriveAesKey()
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      key,
      fromBase64(cipherPart),
    )
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

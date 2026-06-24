import { generateSecret, generateURI, verifySync } from 'otplib'

const ISSUER = 'MOJO Apartments'

export function createTotpSecret(): string {
  return generateSecret()
}

export function buildTotpUri(secret: string, accountLabel: string): string {
  return generateURI({
    issuer: ISSUER,
    label: accountLabel,
    secret,
  })
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const token = code.replace(/\D/g, '')
  if (token.length !== 6) return false

  const result = verifySync({
    token,
    secret,
    // Allow ±1 time step (30s) for phone/server clock drift.
    epochTolerance: 30,
  })
  return result.valid === true
}

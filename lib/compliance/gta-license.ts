export type GtaLicenseStatus = 'valid' | 'expiring_soon' | 'expiring_critical' | 'expired' | 'missing'

export interface GtaLicenseCheck {
  status: GtaLicenseStatus
  expiryDate: string | null
  daysUntilExpiry: number | null
  licenseNumber: string | null
  message: string | null
}

const SOON_DAYS = 30
const CRITICAL_DAYS = 7

export function assessGtaLicense(input: {
  licenseNumber: string | null | undefined
  expiryDate: string | null | undefined
  today?: string
}): GtaLicenseCheck {
  const licenseNumber = input.licenseNumber?.trim() || null
  const expiryDate = input.expiryDate?.trim() || null
  const today = input.today ?? new Date().toISOString().slice(0, 10)

  if (!licenseNumber || !expiryDate) {
    return {
      status: 'missing',
      expiryDate,
      daysUntilExpiry: null,
      licenseNumber,
      message: 'GTA license number and expiry are required for Ghana hospitality compliance.',
    }
  }

  const expiryMs = new Date(`${expiryDate}T12:00:00`).getTime()
  const todayMs = new Date(`${today}T12:00:00`).getTime()
  const daysUntilExpiry = Math.ceil((expiryMs - todayMs) / (24 * 60 * 60 * 1000))

  if (daysUntilExpiry < 0) {
    return {
      status: 'expired',
      expiryDate,
      daysUntilExpiry,
      licenseNumber,
      message: `GTA license expired ${Math.abs(daysUntilExpiry)} day(s) ago. Renew immediately.`,
    }
  }

  if (daysUntilExpiry <= CRITICAL_DAYS) {
    return {
      status: 'expiring_critical',
      expiryDate,
      daysUntilExpiry,
      licenseNumber,
      message: `GTA license expires in ${daysUntilExpiry} day(s). Renew now.`,
    }
  }

  if (daysUntilExpiry <= SOON_DAYS) {
    return {
      status: 'expiring_soon',
      expiryDate,
      daysUntilExpiry,
      licenseNumber,
      message: `GTA license expires in ${daysUntilExpiry} day(s).`,
    }
  }

  return {
    status: 'valid',
    expiryDate,
    daysUntilExpiry,
    licenseNumber,
    message: null,
  }
}

export function gtaAlertIdempotencyKey(hotelId: string, expiryDate: string, tier: string): string {
  return `gta:${hotelId}:${expiryDate}:${tier}`
}

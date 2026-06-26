import type { UserRole } from '@/types'

/** Staff roles that may export guest PII for their active hotel. */
export function canStaffExportGuestData(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/** Only owners may erase guest personal data (Ghana DPA / right to erasure). */
export function canOwnerEraseGuestData(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

/** Billing and payment records are owner-only at the app layer. */
export function canAccessBilling(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

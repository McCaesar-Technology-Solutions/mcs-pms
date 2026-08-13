import type { UserRole } from '@/types'

/** Staff roles that may export guest PII for their active hotel. */
export function canStaffExportGuestData(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/**
 * Soft-erase / orphan hard-delete of guest personal data.
 * Owner, manager, and receptionist (ops desk). In-house stays are blocked in the action.
 */
export function canEraseGuestData(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/** @deprecated Use canEraseGuestData — erasure is no longer owner-only. */
export function canOwnerEraseGuestData(role: UserRole | string | null | undefined): boolean {
  return canEraseGuestData(role)
}

/** View invoices / billing lists (owner, manager, receptionist). */
export function canAccessBilling(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/** Record invoice payments (full/partial). Refunds stay owner-only. */
export function canRecordInvoicePayment(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/** Manual ad-hoc invoices (not stay-linked) remain owner-only. */
export function canCreateManualInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

/** Issue or refresh a stay-linked invoice (check-in / in-house). */
export function canIssueStayInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/** Refunds remain owner-only. */
export function canRefundInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

/** Apply guest stay discounts (pre-tax) on reservations / invoices. */
export function canApplyGuestDiscount(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/** Payroll overview: owners manage fully; managers may view and prepare drafts. */
export function canAccessPayroll(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

/** Compensation rates, commission rules, approve, and mark-paid are owner-only. */
export function canManagePayrollRates(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

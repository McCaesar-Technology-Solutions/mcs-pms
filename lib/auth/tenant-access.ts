import type { UserRole } from '@/types'

/** Staff roles that may export guest PII for their active hotel. */
export function canStaffExportGuestData(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/**
 * Soft-erase / orphan hard-delete of guest personal data — manager+ only.
 */
export function canEraseGuestData(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

/** @deprecated Use canEraseGuestData — same manager+ policy. */
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

/**
 * Manual / ad-hoc invoices (not stay-linked), including unpaid ones.
 * Manager + owner only — reception issues stay invoices via check-in / collect.
 */
export function canCreateManualInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

/** Issue or refresh a stay-linked invoice (check-in / in-house). */
export function canIssueStayInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager' || role === 'receptionist'
}

/**
 * Leave a stay invoice unpaid when issuing/refreshing (document balance due).
 * Reception must collect at the desk (mark paid); manager/owner may issue unpaid.
 */
export function canIssueUnpaidStayInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

/** Refunds remain owner-only. */
export function canRefundInvoice(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

/** Apply guest stay discounts (pre-tax) on reservations / invoices — manager+ only. */
export function canApplyGuestDiscount(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

/** Payroll overview: owners manage fully; managers may view and prepare drafts. */
export function canAccessPayroll(role: UserRole | string | null | undefined): boolean {
  return role === 'owner' || role === 'manager'
}

/** Compensation rates, commission rules, approve, and mark-paid are owner-only. */
export function canManagePayrollRates(role: UserRole | string | null | undefined): boolean {
  return role === 'owner'
}

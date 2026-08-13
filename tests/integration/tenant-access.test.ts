import { describe, expect, it } from 'vitest'
import {
  canAccessBilling,
  canApplyGuestDiscount,
  canCreateManualInvoice,
  canIssueStayInvoice,
  canEraseGuestData,
  canOmitInvoiceTax,
  canOwnerEraseGuestData,
  canRecordInvoicePayment,
  canRefundInvoice,
  canStaffExportGuestData,
} from '@/lib/auth/tenant-access'
import { roleRequiredPath } from '@/lib/auth/roles'

describe('tenant access — guest PII', () => {
  it('allows owner, manager, receptionist to export guest data', () => {
    expect(canStaffExportGuestData('owner')).toBe(true)
    expect(canStaffExportGuestData('manager')).toBe(true)
    expect(canStaffExportGuestData('receptionist')).toBe(true)
  })

  it('denies technician and guest from export', () => {
    expect(canStaffExportGuestData('technician')).toBe(false)
    expect(canStaffExportGuestData('guest')).toBe(false)
    expect(canStaffExportGuestData(null)).toBe(false)
  })

  it('limits erase guest data to manager and owner', () => {
    expect(canEraseGuestData('owner')).toBe(true)
    expect(canEraseGuestData('manager')).toBe(true)
    expect(canEraseGuestData('receptionist')).toBe(false)
    expect(canEraseGuestData('technician')).toBe(false)
    expect(canOwnerEraseGuestData('receptionist')).toBe(false)
    expect(canOwnerEraseGuestData('manager')).toBe(true)
  })
})

describe('tenant access — billing', () => {
  it('allows owner, manager, and receptionist to view billing', () => {
    expect(canAccessBilling('owner')).toBe(true)
    expect(canAccessBilling('manager')).toBe(true)
    expect(canAccessBilling('receptionist')).toBe(true)
    expect(canAccessBilling('technician')).toBe(false)
  })

  it('allows front desk to record payments and issue stay invoices', () => {
    expect(canRecordInvoicePayment('owner')).toBe(true)
    expect(canRecordInvoicePayment('manager')).toBe(true)
    expect(canRecordInvoicePayment('receptionist')).toBe(true)
    expect(canIssueStayInvoice('receptionist')).toBe(true)
    expect(canIssueStayInvoice('technician')).toBe(false)
  })

  it('keeps refunds and manual invoices owner-only', () => {
    expect(canRefundInvoice('owner')).toBe(true)
    expect(canRefundInvoice('manager')).toBe(false)
    expect(canRefundInvoice('receptionist')).toBe(false)
    expect(canCreateManualInvoice('owner')).toBe(true)
    expect(canCreateManualInvoice('manager')).toBe(false)
    expect(canCreateManualInvoice('receptionist')).toBe(false)
  })

  it('limits guest discounts to manager and owner', () => {
    expect(canApplyGuestDiscount('owner')).toBe(true)
    expect(canApplyGuestDiscount('manager')).toBe(true)
    expect(canApplyGuestDiscount('receptionist')).toBe(false)
    expect(canApplyGuestDiscount('technician')).toBe(false)
  })

  it('keeps tax invoices for reception; only manager/owner may omit tax', () => {
    expect(canOmitInvoiceTax('owner')).toBe(true)
    expect(canOmitInvoiceTax('manager')).toBe(true)
    expect(canOmitInvoiceTax('receptionist')).toBe(false)
    expect(canIssueStayInvoice('receptionist')).toBe(true)
  })

  it('maps billing paths to role prefixes', () => {
    expect(roleRequiredPath('/owner/billing')).toBe('owner')
    expect(roleRequiredPath('/manager/invoices')).toBe('manager')
    expect(roleRequiredPath('/receptionist/billing')).toBe('receptionist')
    expect(roleRequiredPath('/manager/dashboard')).toBe('manager')
  })
})

describe('cross-tenant path guards', () => {
  it('does not treat guest portal as staff-scoped', () => {
    expect(roleRequiredPath('/guest')).toBeNull()
    expect(roleRequiredPath('/guest/join/mojo-osu')).toBeNull()
  })

  it('requires owner prefix for GRA reports', () => {
    expect(roleRequiredPath('/owner/gra-reports')).toBe('owner')
    expect(roleRequiredPath('/manager/gra-reports')).toBe('manager')
  })
})

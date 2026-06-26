import { describe, expect, it } from 'vitest'
import {
  canAccessBilling,
  canOwnerEraseGuestData,
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

  it('restricts erasure to owner only', () => {
    expect(canOwnerEraseGuestData('owner')).toBe(true)
    expect(canOwnerEraseGuestData('manager')).toBe(false)
    expect(canOwnerEraseGuestData('receptionist')).toBe(false)
  })
})

describe('tenant access — billing isolation', () => {
  it('limits billing routes to owner at app layer', () => {
    expect(canAccessBilling('owner')).toBe(true)
    expect(canAccessBilling('manager')).toBe(false)
    expect(canAccessBilling('receptionist')).toBe(false)
  })

  it('maps billing paths to owner role prefix', () => {
    expect(roleRequiredPath('/owner/billing')).toBe('owner')
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

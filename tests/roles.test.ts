import { describe, expect, it } from 'vitest'
import {
  ROLE_HOME,
  STAFF_ROLES,
  isStaffRole,
  roleRequiredPath,
} from '@/lib/auth/roles'

describe('isStaffRole', () => {
  it('accepts every staff role', () => {
    for (const role of ['owner', 'manager', 'technician', 'receptionist']) {
      expect(isStaffRole(role)).toBe(true)
    }
  })

  it('rejects guests, unknown values, and nullish input', () => {
    expect(isStaffRole('guest')).toBe(false)
    expect(isStaffRole('admin')).toBe(false)
    expect(isStaffRole(null)).toBe(false)
    expect(isStaffRole(undefined)).toBe(false)
  })
})

describe('ROLE_HOME', () => {
  it('maps each staff role to its dashboard', () => {
    expect(ROLE_HOME.owner).toBe('/owner/dashboard')
    expect(ROLE_HOME.manager).toBe('/manager/dashboard')
    expect(ROLE_HOME.receptionist).toBe('/receptionist/dashboard')
    expect(ROLE_HOME.technician).toBe('/technician/tasks')
  })

  it('has a home for every role in STAFF_ROLES', () => {
    for (const role of STAFF_ROLES) {
      expect(ROLE_HOME[role]).toBeTruthy()
    }
  })
})

describe('roleRequiredPath', () => {
  it('resolves role-scoped prefixes', () => {
    expect(roleRequiredPath('/owner/dashboard')).toBe('owner')
    expect(roleRequiredPath('/manager/rooms')).toBe('manager')
    expect(roleRequiredPath('/receptionist/reservations')).toBe('receptionist')
    expect(roleRequiredPath('/technician/tasks')).toBe('technician')
  })

  it('treats legacy /dashboard as generic staff', () => {
    expect(roleRequiredPath('/dashboard')).toBe('staff')
  })

  it('returns null for unguarded paths', () => {
    expect(roleRequiredPath('/login')).toBeNull()
    expect(roleRequiredPath('/guest/enter')).toBeNull()
  })
})

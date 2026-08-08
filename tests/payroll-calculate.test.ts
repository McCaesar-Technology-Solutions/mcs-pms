import { describe, expect, it } from 'vitest'
import {
  computeCommissionAmount,
  computeNetPay,
  defaultPeriodBounds,
  formatPeriodLabel,
  percentChange,
  roundMoney,
  sumRunTotals,
} from '@/lib/payroll/calculate'
import { canAccessPayroll, canManagePayrollRates } from '@/lib/auth/tenant-access'

describe('payroll calculate', () => {
  it('rounds money to 2 decimals', () => {
    expect(roundMoney(10.005)).toBe(10.01)
    expect(roundMoney(10.004)).toBe(10)
  })

  it('computes net pay', () => {
    expect(
      computeNetPay({ basePay: 2000, commission: 450, allowances: 100, deductions: 50 }),
    ).toBe(2500)
  })

  it('computes flat and percent commission', () => {
    expect(computeCommissionAmount('flat', 25, 0)).toBe(25)
    expect(computeCommissionAmount('percent', 10, 200)).toBe(20)
  })

  it('sums run totals excluding excluded lines', () => {
    const totals = sumRunTotals([
      {
        basePay: 100,
        commission: 10,
        allowances: 0,
        deductions: 5,
        netPay: 105,
        status: 'unpaid',
      },
      {
        basePay: 50,
        commission: 0,
        allowances: 0,
        deductions: 0,
        netPay: 50,
        status: 'excluded',
      },
    ])
    expect(totals.employeeCount).toBe(1)
    expect(totals.totalNet).toBe(105)
    expect(totals.totalBase).toBe(100)
  })

  it('computes percent change', () => {
    expect(percentChange(110, 100)).toBe(10)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(50, 0)).toBeNull()
  })

  it('builds monthly period bounds', () => {
    const bounds = defaultPeriodBounds('monthly', new Date('2025-03-15T12:00:00'))
    expect(bounds.periodStart).toBe('2025-03-01')
    expect(bounds.periodEnd).toBe('2025-03-31')
  })

  it('formats period labels', () => {
    expect(formatPeriodLabel('2025-03-01', '2025-03-31')).toContain('Mar')
  })
})

describe('payroll access', () => {
  it('allows owner and manager to access payroll', () => {
    expect(canAccessPayroll('owner')).toBe(true)
    expect(canAccessPayroll('manager')).toBe(true)
    expect(canAccessPayroll('receptionist')).toBe(false)
    expect(canAccessPayroll('technician')).toBe(false)
  })

  it('restricts rate management to owners', () => {
    expect(canManagePayrollRates('owner')).toBe(true)
    expect(canManagePayrollRates('manager')).toBe(false)
  })
})

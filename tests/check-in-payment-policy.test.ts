import { describe, expect, it } from 'vitest'
import {
  assertCheckInPaymentMet,
  countStayNights,
  isChannelPrepaidStay,
  requiredPaymentAtCheckIn,
} from '@/lib/billing/check-in-payment-policy'

describe('requiredPaymentAtCheckIn', () => {
  it('returns zero for complimentary or none mode', () => {
    expect(
      requiredPaymentAtCheckIn({
        invoiceTotal: 0,
        nights: 2,
        nightlyRate: 100,
        mode: 'percent',
        value: 50,
      }),
    ).toBe(0)
    expect(
      requiredPaymentAtCheckIn({
        invoiceTotal: 500,
        nights: 2,
        nightlyRate: 250,
        mode: 'none',
        value: 50,
      }),
    ).toBe(0)
  })

  it('computes percent minimum capped at total', () => {
    expect(
      requiredPaymentAtCheckIn({
        invoiceTotal: 400,
        nights: 2,
        nightlyRate: 200,
        mode: 'percent',
        value: 50,
      }),
    ).toBe(200)
    expect(
      requiredPaymentAtCheckIn({
        invoiceTotal: 100,
        nights: 1,
        nightlyRate: 100,
        mode: 'percent',
        value: 150,
      }),
    ).toBe(100)
  })

  it('computes fixed minimum capped at total', () => {
    expect(
      requiredPaymentAtCheckIn({
        invoiceTotal: 800,
        nights: 3,
        nightlyRate: 266.67,
        mode: 'fixed',
        value: 300,
      }),
    ).toBe(300)
  })

  it('uses first night rate when mode is first_night', () => {
    expect(
      requiredPaymentAtCheckIn({
        invoiceTotal: 600,
        nights: 3,
        nightlyRate: 200,
        mode: 'first_night',
        value: 0,
      }),
    ).toBe(200)
  })
})

describe('assertCheckInPaymentMet', () => {
  const base = {
    invoiceTotal: 400,
    nights: 2,
    nightlyRate: 200,
    mode: 'percent' as const,
    value: 50,
  }

  it('passes when amount paid meets minimum', () => {
    expect(assertCheckInPaymentMet({ ...base, amountPaid: 200 }).ok).toBe(true)
    expect(assertCheckInPaymentMet({ ...base, amountPaid: 199.99 }).ok).toBe(false)
  })

  it('allows complimentary stays', () => {
    expect(
      assertCheckInPaymentMet({
        ...base,
        invoiceTotal: 0,
        amountPaid: 0,
        complimentary: true,
      }).ok,
    ).toBe(true)
  })

  it('allows manager override below minimum', () => {
    expect(
      assertCheckInPaymentMet({
        ...base,
        amountPaid: 0,
        managerOverride: true,
      }).ok,
    ).toBe(true)
  })

  it('reports shortfall when under minimum', () => {
    const result = assertCheckInPaymentMet({ ...base, amountPaid: 50 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.required).toBe(200)
      expect(result.shortfall).toBe(150)
    }
  })
})

describe('isChannelPrepaidStay', () => {
  it('treats paid status as prepaid', () => {
    expect(
      isChannelPrepaidStay({
        channel: 'direct',
        paymentStatus: 'paid',
        amountPaid: 0,
        requiredMinimum: 200,
      }),
    ).toBe(true)
  })

  it('treats OTA with sufficient deposit as prepaid', () => {
    expect(
      isChannelPrepaidStay({
        channel: 'airbnb',
        paymentStatus: 'partial',
        amountPaid: 250,
        requiredMinimum: 200,
      }),
    ).toBe(true)
    expect(
      isChannelPrepaidStay({
        channel: 'booking_com',
        paymentStatus: 'deposit_paid',
        amountPaid: 50,
        requiredMinimum: 200,
      }),
    ).toBe(false)
  })
})

describe('countStayNights', () => {
  it('counts nights between dates', () => {
    expect(countStayNights('2026-08-01', '2026-08-03')).toBe(2)
  })
})

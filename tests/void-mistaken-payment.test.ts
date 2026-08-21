import { describe, expect, it } from 'vitest'
import { planVoidMistakenDeskPayment } from '@/lib/billing/void-mistaken-payment'

describe('planVoidMistakenDeskPayment', () => {
  it('voids manual success rows and restores pending', () => {
    const plan = planVoidMistakenDeskPayment({
      paymentStatus: 'paid',
      totalAmount: 400,
      amountPaid: 400,
      records: [
        { id: 'p1', provider: 'manual', status: 'success', amount: 400 },
      ],
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.voidRecordIds).toEqual(['p1'])
    expect(plan.voidedAmount).toBe(400)
    expect(plan.remainingPaid).toBe(0)
    expect(plan.nextStatus).toBe('pending')
    expect(plan.cacheOnly).toBe(false)
  })

  it('keeps online charges and only voids desk rows', () => {
    const plan = planVoidMistakenDeskPayment({
      paymentStatus: 'paid',
      totalAmount: 500,
      amountPaid: 500,
      records: [
        { id: 'online', provider: 'paystack', status: 'success', amount: 200 },
        { id: 'desk', provider: 'manual', status: 'success', amount: 300 },
      ],
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.voidRecordIds).toEqual(['desk'])
    expect(plan.remainingPaid).toBe(200)
    expect(plan.nextStatus).toBe('partial')
  })

  it('refuses online-only invoices', () => {
    const plan = planVoidMistakenDeskPayment({
      paymentStatus: 'paid',
      totalAmount: 200,
      amountPaid: 200,
      records: [{ id: 'online', provider: 'paystack', status: 'success', amount: 200 }],
    })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.error).toMatch(/online payments/i)
  })

  it('refuses invoices already refunded', () => {
    const plan = planVoidMistakenDeskPayment({
      paymentStatus: 'refunded',
      totalAmount: 400,
      amountPaid: 0,
      records: [],
    })

    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.error).toMatch(/refunded/i)
  })

  it('clears a paid cache with no ledger rows', () => {
    const plan = planVoidMistakenDeskPayment({
      paymentStatus: 'paid',
      totalAmount: 400,
      amountPaid: 400,
      records: [],
    })

    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.cacheOnly).toBe(true)
    expect(plan.voidRecordIds).toEqual([])
    expect(plan.nextStatus).toBe('pending')
  })

  it('ignores already voided rows', () => {
    const plan = planVoidMistakenDeskPayment({
      paymentStatus: 'pending',
      totalAmount: 400,
      amountPaid: 0,
      records: [{ id: 'p1', provider: 'manual', status: 'voided', amount: 400 }],
    })

    expect(plan.ok).toBe(false)
  })
})

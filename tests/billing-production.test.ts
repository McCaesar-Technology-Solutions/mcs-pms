import { describe, expect, it } from 'vitest'
import {
  requiresDepositDisposition,
  validateDepositDispositionInput,
} from '@/lib/billing/deposit-disposition'
import { shouldMarkInvoiceOverdue } from '@/lib/billing/mark-overdue'
import { computeHotelOutstandingBalance } from '@/lib/billing/outstanding-balance'
import { folioSubtotalForStay } from '@/lib/folio/batch-totals'
import type { DbInvoice, Reservation } from '@/types'

describe('deposit disposition', () => {
  it('requires disposition when deposit collected', () => {
    expect(requiresDepositDisposition(100)).toBe(true)
    expect(requiresDepositDisposition(0)).toBe(false)
  })

  it('blocks without disposition', () => {
    const result = validateDepositDispositionInput(50, undefined, 'manager')
    expect(result.ok).toBe(false)
  })

  it('allows forfeit for staff', () => {
    expect(validateDepositDispositionInput(50, 'forfeit', 'receptionist').ok).toBe(true)
  })

  it('restricts refund to owner', () => {
    expect(validateDepositDispositionInput(50, 'refund', 'manager').ok).toBe(false)
    expect(validateDepositDispositionInput(50, 'refund', 'owner').ok).toBe(true)
  })
})

describe('mark overdue', () => {
  it('flags past-due pending invoices', () => {
    expect(
      shouldMarkInvoiceOverdue('pending', '2026-01-01T00:00:00Z', '2026-06-15'),
    ).toBe(true)
    expect(
      shouldMarkInvoiceOverdue('pending', '2026-12-01T00:00:00Z', '2026-06-15'),
    ).toBe(false)
    expect(shouldMarkInvoiceOverdue('paid', '2026-01-01T00:00:00Z', '2026-06-15')).toBe(
      false,
    )
  })
})

describe('outstanding balance', () => {
  const baseReservation = (overrides: Partial<Reservation>): Reservation =>
    ({
      id: 'r1',
      bookingRef: 'MOJO',
      guestId: 'g1',
      guestName: 'Guest',
      guestEmail: '',
      guestPhone: '',
      roomId: 'room',
      roomNumber: '1',
      propertyId: 'h1',
      checkInDate: '2026-06-01',
      checkOutDate: '2026-06-03',
      status: 'confirmed',
      numberOfNights: 2,
      totalPrice: 200,
      paidAmount: 0,
      folioSubtotal: 0,
      estimatedTotal: 200,
      balanceDue: 200,
      paymentStatus: 'unpaid',
      depositAmount: 0,
      currency: 'GHS',
      source: 'walk_in',
      channel: 'walk_in',
      rateType: 'nightly',
      nightlyRate: 100,
      monthlyRate: 0,
      createdAt: '',
      updatedAt: '',
      ...overrides,
    }) as Reservation

  it('sums reservation balances and manual invoices without double counting', () => {
    const reservations = [
      baseReservation({ id: 'r1', balanceDue: 150, status: 'checked_in' }),
      baseReservation({
        id: 'r2',
        balanceDue: 80,
        status: 'checked_out',
        paymentStatus: 'partial',
      }),
    ]
    const invoices: DbInvoice[] = [
      {
        id: 'i1',
        reservation_id: 'r2',
        total_amount: 200,
        amount_paid: 120,
        payment_status: 'partial',
      } as DbInvoice,
      {
        id: 'i2',
        reservation_id: null,
        total_amount: 50,
        amount_paid: 0,
        payment_status: 'pending',
      } as DbInvoice,
    ]

    const summary = computeHotelOutstandingBalance(reservations, invoices)
    expect(summary.total).toBe(280)
    expect(summary.reservationCount).toBe(2)
    expect(summary.invoiceOnlyCount).toBe(1)
  })

  it('ignores voided reservations', () => {
    const summary = computeHotelOutstandingBalance(
      [baseReservation({ status: 'cancelled', balanceDue: 100 })],
      [],
    )
    expect(summary.total).toBe(0)
  })
})

describe('folio subtotal for stay', () => {
  it('combines reservation-specific and guest-level charges', () => {
    const map = new Map<string, number>([
      ['g1:r1', 30],
      ['g1:', 20],
    ])
    expect(folioSubtotalForStay(map, 'g1', 'r1')).toBe(50)
    expect(folioSubtotalForStay(map, 'g2', 'r1')).toBe(0)
  })
})

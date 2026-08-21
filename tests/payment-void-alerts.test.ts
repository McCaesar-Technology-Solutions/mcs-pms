import { describe, expect, it } from 'vitest'
import { paymentVoidAlertFromAudit } from '@/lib/data/payment-void-alerts'

const row = {
  id: 'a1',
  actor_id: 'staff-1',
  actor_name: 'Ama',
  entity_id: 'inv-1',
  summary: 'Voided mistaken desk payment on Kojo Mensah invoice',
  details: { voidedAmount: 400, actorRole: 'receptionist' },
  created_at: '2026-08-21T10:00:00.000Z',
}

describe('paymentVoidAlertFromAudit', () => {
  it('builds an owner alert for a staff void', () => {
    const alert = paymentVoidAlertFromAudit(row, {
      viewerId: 'owner-1',
      billingHref: '/owner/billing',
    })

    expect(alert).toMatchObject({
      title: 'Desk payment voided',
      subtitle: 'Ama (reception) cleared ₵400.00 on Kojo Mensah',
      href: '/owner/billing?open=inv-1',
      urgent: true,
    })
  })

  it('skips the viewer’s own void', () => {
    expect(
      paymentVoidAlertFromAudit(row, {
        viewerId: 'staff-1',
        billingHref: '/owner/billing',
      }),
    ).toBeNull()
  })
})

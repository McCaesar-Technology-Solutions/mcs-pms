import { PLAN_CATALOG, type SubscriptionSnapshot } from '@/lib/saas/plans'

interface SubscriptionPlanPanelProps {
  subscription: SubscriptionSnapshot | null
  propertyCount: number
}

export function SubscriptionPlanPanel({ subscription, propertyCount }: SubscriptionPlanPanelProps) {
  if (!subscription) {
    return (
      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold">Plan & billing</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Subscription details appear after migration 041 is applied.
        </p>
      </div>
    )
  }

  const catalog = PLAN_CATALOG[subscription.plan]

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-header">
        <h2 className="text-lg font-semibold">Plan & billing</h2>
        <p className="text-sm text-muted-foreground">{subscription.organizationName}</p>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current plan</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{catalog.label}</p>
          <p className="mt-1 text-sm text-muted-foreground capitalize">{subscription.status.replace('_', ' ')}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usage</p>
          <p className="mt-1 text-sm text-foreground">
            {propertyCount} / {subscription.maxProperties} propert
            {subscription.maxProperties === 1 ? 'y' : 'ies'}
          </p>
          <p className="text-sm text-muted-foreground">
            Up to {subscription.maxRoomsPerProperty} rooms per property
          </p>
        </div>
      </div>
      {subscription.status === 'trialing' && subscription.daysLeftInTrial != null && (
        <div className="border-t border-[#E9ECEF] bg-[#F4F0FF]/50 px-6 py-4 text-sm text-foreground">
          {subscription.isTrialExpired ? (
            <p>Your trial has ended. Contact support to upgrade — self-serve billing is coming soon.</p>
          ) : (
            <p>
              <strong>{subscription.daysLeftInTrial} day{subscription.daysLeftInTrial === 1 ? '' : 's'}</strong>{' '}
              remaining on your free trial. No card on file yet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

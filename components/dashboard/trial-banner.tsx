import Link from 'next/link'
import type { SubscriptionSnapshot } from '@/lib/saas/plans'

interface TrialBannerProps {
  subscription: SubscriptionSnapshot
}

export function TrialBanner({ subscription }: TrialBannerProps) {
  if (subscription.status !== 'trialing') return null

  const days = subscription.daysLeftInTrial
  const urgent = days != null && days <= 7
  const expired = subscription.isTrialExpired

  if (!urgent && !expired) return null

  return (
    <div
      className={`border-b px-4 py-3 text-sm ${
        expired
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p>
          {expired ? (
            <>
              Your free trial for <strong>{subscription.organizationName}</strong> has ended. Upgrade
              to keep adding reservations and staff access.
            </>
          ) : (
            <>
              <strong>{days} day{days === 1 ? '' : 's'}</strong> left in your free trial for{' '}
              {subscription.organizationName}.
            </>
          )}
        </p>
        <Link
          href="/owner/settings"
          className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
        >
          View plan
        </Link>
      </div>
    </div>
  )
}

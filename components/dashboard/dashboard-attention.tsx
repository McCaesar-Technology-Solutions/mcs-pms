import Link from 'next/link'
import { AlertCircle, LogIn, Sparkles } from 'lucide-react'
import type { TodayOperations } from '@/lib/data/overview'
import type { KPIMetrics } from '@/types'

interface DashboardAttentionProps {
  today: TodayOperations
  metrics?: KPIMetrics
  billingHref?: string
  reservationsHref?: string
}

export function DashboardAttention({
  today,
  metrics,
  billingHref = '/owner/billing',
  reservationsHref = '/owner/reservations',
}: DashboardAttentionProps) {
  const items: { key: string; icon: typeof LogIn; tone: string; message: string; href: string }[] = []

  if (today.arrivalsToday > 0) {
    items.push({
      key: 'arrivals',
      icon: LogIn,
      tone: 'attention-chip--info',
      message: `${today.arrivalsToday} arrival${today.arrivalsToday === 1 ? '' : 's'} expected today`,
      href: reservationsHref,
    })
  }

  if (metrics && metrics.outstandingCount > 0) {
    items.push({
      key: 'balances',
      icon: AlertCircle,
      tone: 'attention-chip--warning',
      message: `₵${metrics.outstandingBalance.toLocaleString()} unpaid across ${metrics.outstandingCount} invoice${metrics.outstandingCount === 1 ? '' : 's'}`,
      href: billingHref,
    })
  }

  if (items.length === 0) {
    return (
      <div className="attention-strip attention-strip--clear">
        <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
        <p className="text-sm text-muted-foreground">
          Operations look clear for today — no arrivals or unpaid balances need immediate attention.
        </p>
      </div>
    )
  }

  return (
    <div className="attention-strip">
      <p className="attention-strip__label">Needs attention</p>
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, icon: Icon, tone, message, href }) => (
          <Link key={key} href={href} className={`attention-chip ${tone}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            <span>{message}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

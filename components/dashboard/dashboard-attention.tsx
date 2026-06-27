import Link from 'next/link'
import { AlertCircle, LogIn, CheckCircle2 } from 'lucide-react'
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
  const items: {
    key: string
    icon: typeof LogIn
    tone: 'info' | 'warning'
    message: string
    href: string
  }[] = []

  if (today.arrivalsToday > 0) {
    items.push({
      key: 'arrivals',
      icon: LogIn,
      tone: 'info',
      message: `${today.arrivalsToday} arrival${today.arrivalsToday === 1 ? '' : 's'} expected today`,
      href: reservationsHref,
    })
  }

  if (metrics && metrics.outstandingCount > 0) {
    items.push({
      key: 'balances',
      icon: AlertCircle,
      tone: 'warning',
      message: `₵${metrics.outstandingBalance.toLocaleString()} unpaid · ${metrics.outstandingCount} invoice${metrics.outstandingCount === 1 ? '' : 's'}`,
      href: billingHref,
    })
  }

  if (items.length === 0) {
    return (
      <div className="attention-strip attention-strip--clear flex items-center gap-2.5 rounded-xl px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2} />
        <p className="text-sm text-muted-foreground">No urgent items for today.</p>
      </div>
    )
  }

  return (
    <div className="attention-strip">
      <p className="attention-strip__label">Needs attention</p>
      <div className="flex flex-wrap gap-2">
      {items.map(({ key, icon: Icon, tone, message, href }) => (
        <Link
          key={key}
          href={href}
          className={`attention-chip attention-chip--${tone}`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
          <span>{message}</span>
        </Link>
      ))}
      </div>
    </div>
  )
}

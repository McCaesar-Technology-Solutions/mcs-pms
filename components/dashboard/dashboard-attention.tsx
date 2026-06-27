import Link from 'next/link'
import {
  AlertCircle,
  LogIn,
  LogOut,
  CheckCircle2,
  Briefcase,
} from 'lucide-react'
import type { TodayOperations } from '@/lib/data/overview'
import type { KPIMetrics } from '@/types'

interface DashboardAttentionProps {
  today: TodayOperations
  metrics?: KPIMetrics
  overdueTasks?: number
  billingHref?: string
  reservationsHref?: string
  housekeepingHref?: string
}

export function DashboardAttention({
  today,
  metrics,
  overdueTasks = 0,
  billingHref = '/owner/billing',
  reservationsHref = '/owner/reservations',
  housekeepingHref = '/owner/housekeeping',
}: DashboardAttentionProps) {
  const items: {
    key: string
    icon: typeof LogIn
    tone: 'info' | 'warning' | 'urgent'
    message: string
    href: string
  }[] = []

  if (metrics && metrics.outstandingCount > 0) {
    items.push({
      key: 'balances',
      icon: AlertCircle,
      tone: 'urgent',
      message: `₵${metrics.outstandingBalance.toLocaleString()} unpaid · ${metrics.outstandingCount} invoice${metrics.outstandingCount === 1 ? '' : 's'}`,
      href: billingHref,
    })
  }

  if (today.arrivalsToday > 0) {
    items.push({
      key: 'arrivals',
      icon: LogIn,
      tone: 'info',
      message: `${today.arrivalsToday} arrival${today.arrivalsToday === 1 ? '' : 's'} today`,
      href: `${reservationsHref}?checkIn=today`,
    })
  }

  if (today.departuresToday > 0) {
    items.push({
      key: 'departures',
      icon: LogOut,
      tone: 'info',
      message: `${today.departuresToday} departure${today.departuresToday === 1 ? '' : 's'} today`,
      href: reservationsHref,
    })
  }

  if (overdueTasks > 0) {
    items.push({
      key: 'tasks',
      icon: Briefcase,
      tone: 'warning',
      message: `${overdueTasks} overdue task${overdueTasks === 1 ? '' : 's'}`,
      href: housekeepingHref,
    })
  }

  if (items.length === 0) {
    return (
      <div className="attention-panel attention-panel--clear">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
        <p className="text-sm text-muted-foreground">All clear for today — nothing needs immediate action.</p>
      </div>
    )
  }

  return (
    <div className="attention-panel">
      <div className="attention-panel__header">
        <p className="attention-panel__title">Needs attention</p>
        <p className="attention-panel__count">{items.length} item{items.length === 1 ? '' : 's'}</p>
      </div>
      <div className="attention-panel__items">
        {items.map(({ key, icon: Icon, tone, message, href }) => (
          <Link key={key} href={href} className={`attention-panel__item attention-panel__item--${tone}`}>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            <span className="flex-1">{message}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

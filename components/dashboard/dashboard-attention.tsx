import Link from 'next/link'
import {
  AlertCircle,
  LogIn,
  LogOut,
  CheckCircle2,
  Briefcase,
  ChevronRight,
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
      <div className="attention-panel attention-panel--clear" role="status">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--brand-gold-dark)]" strokeWidth={2} />
        <p className="text-sm text-muted-foreground">All clear for today — nothing needs immediate action.</p>
      </div>
    )
  }

  const hasUrgent = items.some((item) => item.tone === 'urgent')

  return (
    <div
      className={`attention-panel attention-panel--active${hasUrgent ? ' attention-panel--urgent' : ''}`}
      role="region"
      aria-label={`Needs attention, ${items.length} item${items.length === 1 ? '' : 's'}`}
    >
      <div className="attention-panel__header">
        <div className="attention-panel__heading">
          <AlertCircle className="attention-panel__header-icon" strokeWidth={2.25} aria-hidden />
          <p className="attention-panel__title">Needs attention</p>
        </div>
        <span className="attention-panel__badge" aria-hidden>
          {items.length}
        </span>
      </div>
      <div className="attention-panel__items">
        {items.map(({ key, icon: Icon, tone, message, href }) => (
          <Link key={key} href={href} className={`attention-panel__item attention-panel__item--${tone}`}>
            <span className="attention-panel__item-icon" aria-hidden>
              <Icon className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="attention-panel__item-text">{message}</span>
            <ChevronRight className="attention-panel__item-chevron h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  )
}

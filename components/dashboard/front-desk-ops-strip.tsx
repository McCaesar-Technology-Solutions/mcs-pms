import Link from 'next/link'
import {
  Brush,
  LogIn,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { OpsDateSelector } from '@/components/dashboard/ops-date-selector'
import {
  frontDeskOpsLinks,
  type ExtendedTodayOperations,
  type StaffRoutePrefix,
} from '@/lib/data/front-desk-ops'
import { formatOpsDateLabel, isOpsDateToday } from '@/lib/dates/ops-date'

interface FrontDeskOpsStripProps {
  ops: ExtendedTodayOperations
  opsDate: string
  routePrefix: StaffRoutePrefix
  title?: string
  showDateSelector?: boolean
}

function OpsTile({
  href,
  icon: Icon,
  label,
  value,
  tone,
}: {
  href: string
  icon: typeof Users
  label: string
  value: number
  tone: 'purple' | 'teal' | 'sky' | 'coral' | 'amber' | 'gold' | 'lime'
}) {
  return (
    <Link href={href} className={`front-desk-ops-tile front-desk-ops-tile--${tone}`}>
      <span className="front-desk-ops-tile__icon">
        <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="front-desk-ops-tile__body">
        <span className="front-desk-ops-tile__value">{value}</span>
        <span className="front-desk-ops-tile__label">{label}</span>
      </span>
    </Link>
  )
}

export function FrontDeskOpsStrip({
  ops,
  opsDate,
  routePrefix,
  title = 'Front desk',
  showDateSelector = true,
}: FrontDeskOpsStripProps) {
  const links = frontDeskOpsLinks(routePrefix, opsDate)
  const dateContext = isOpsDateToday(opsDate)
    ? 'Today'
    : formatOpsDateLabel(opsDate)

  return (
    <section className="front-desk-ops" aria-label="Front desk operations">
      <div className="front-desk-ops__header">
        <div className="min-w-0">
          <p className="label-eyebrow label-eyebrow-accent">{dateContext}</p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {showDateSelector && <OpsDateSelector opsDate={opsDate} />}
      </div>

      <div className="front-desk-ops__grid">
        <OpsTile
          href={links.inHouse}
          icon={Users}
          label="In house"
          value={ops.guestsInHouse}
          tone="purple"
        />
        <OpsTile
          href={links.arrivals}
          icon={LogIn}
          label="Arrivals"
          value={ops.arrivalsToday}
          tone="sky"
        />
        <OpsTile
          href={links.departures}
          icon={LogOut}
          label="Departures"
          value={ops.departuresToday}
          tone="coral"
        />
        <OpsTile
          href={links.dirty}
          icon={Brush}
          label="Dirty / inspect"
          value={ops.dirtyRooms}
          tone="amber"
        />
        <OpsTile
          href={links.guestRequests}
          icon={UserCheck}
          label="Guest requests"
          value={ops.guestRequests}
          tone="gold"
        />
        <OpsTile
          href={links.messages}
          icon={MessageCircle}
          label="Unread messages"
          value={ops.unreadMessages}
          tone="lime"
        />
        <OpsTile
          href={links.prepaid}
          icon={ShieldCheck}
          label="Prepaid arrivals"
          value={ops.prepaidArrivals}
          tone="teal"
        />
        <OpsTile
          href={links.rooms}
          icon={Sparkles}
          label="Vacant rooms"
          value={ops.vacantRooms}
          tone="purple"
        />
        {ops.maintenanceRooms > 0 && (
          <OpsTile
            href={`${routePrefix}/rooms?view=floor&filter=maintenance&opsDate=${encodeURIComponent(opsDate)}`}
            icon={Wrench}
            label="Maintenance"
            value={ops.maintenanceRooms}
            tone="coral"
          />
        )}
      </div>
    </section>
  )
}

import { LogIn, LogOut, Percent, Users } from 'lucide-react'
import type { OccupancyToday } from '@/lib/data/occupancy'
import type { TodayOperations } from '@/lib/data/overview'

interface DashboardToolbarProps {
  occupancy?: OccupancyToday
  today: TodayOperations
  title?: string
  eyebrow?: string
}

type StatAccent = 'occupancy' | 'in-house' | 'arrivals' | 'departures'

const accentClass: Record<StatAccent, string> = {
  occupancy: 'stat-chip--occupancy',
  'in-house': 'stat-chip--in-house',
  arrivals: 'stat-chip--arrivals',
  departures: 'stat-chip--departures',
}

const accentIcon: Record<StatAccent, string> = {
  occupancy: 'text-emerald-600',
  'in-house': 'text-primary',
  arrivals: 'text-sky-600',
  departures: 'text-[var(--brand-orange)]',
}

function StatChip({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Percent
  label: string
  value: string
  detail?: string
  accent: StatAccent
}) {
  return (
    <div className={`stat-chip surface-card relative min-w-0 flex-1 overflow-hidden ${accentClass[accent]}`}>
      <div className="stat-chip__accent" aria-hidden />
      <div className="relative px-3.5 py-3.5 sm:px-4 sm:py-4">
        <p className="text-[2.35rem] font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-[2.65rem]">
          {value}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          <Icon className={`h-4 w-4 shrink-0 ${accentIcon[accent]}`} strokeWidth={2.25} />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
        {detail && (
          <p className="mt-1 truncate pl-5 text-[10px] text-muted-foreground/85">{detail}</p>
        )}
      </div>
    </div>
  )
}

export function DashboardToolbar({
  occupancy,
  today,
  title = 'Dashboard',
  eyebrow = 'Operations centre',
}: DashboardToolbarProps) {
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="label-eyebrow label-eyebrow-accent">{eyebrow}</p>
        <h1 className="font-display mt-1 text-[1.75rem] font-semibold tracking-tight text-white sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-white/58">{dateLabel}</p>
      </div>

      <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 lg:max-w-[42rem] lg:flex-1">
        <StatChip
          accent="occupancy"
          icon={Percent}
          label="Occupancy"
          value={occupancy ? `${occupancy.percent}%` : '—'}
          detail={occupancy ? `${occupancy.occupied} of ${occupancy.total} rooms` : undefined}
        />
        <StatChip
          accent="in-house"
          icon={Users}
          label="In house"
          value={String(today.guestsInHouse)}
          detail="Guests checked in"
        />
        <StatChip
          accent="arrivals"
          icon={LogIn}
          label="Arrivals"
          value={String(today.arrivalsToday)}
          detail="Checking in today"
        />
        <StatChip
          accent="departures"
          icon={LogOut}
          label="Departures"
          value={String(today.departuresToday)}
          detail="Checking out today"
        />
      </div>
    </header>
  )
}

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

const accentIcon: Record<StatAccent, string> = {
  occupancy: 'text-emerald-400',
  'in-house': 'text-[var(--brand-gold-light)]',
  arrivals: 'text-sky-300',
  departures: 'text-orange-300',
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
    <div
      className={`stat-chip stat-chip--${accent} min-w-0 flex-1 rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accentIcon[accent]}`} strokeWidth={2.25} aria-hidden />
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-[2.15rem]">
        {value}
      </p>
      {detail && (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{detail}</p>
      )}
    </div>
  )
}

export function DashboardToolbar({
  occupancy,
  today,
  title = 'Dashboard',
  eyebrow = 'Today',
}: DashboardToolbarProps) {
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="label-eyebrow label-eyebrow-accent">{eyebrow}</p>
          <h1 className="font-display mt-1 text-[1.85rem] font-semibold tracking-tight text-white sm:text-[2.25rem]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-[40rem] lg:flex-1">
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
      </div>
    </header>
  )
}

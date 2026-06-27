import { LogIn, LogOut, Percent, Users } from 'lucide-react'
import type { OccupancyToday } from '@/lib/data/occupancy'
import type { TodayOperations } from '@/lib/data/overview'

interface DashboardToolbarProps {
  occupancy?: OccupancyToday
  today: TodayOperations
}

type StatAccent = 'occupancy' | 'in-house' | 'arrivals' | 'departures'

const accentBar: Record<StatAccent, string> = {
  occupancy: 'bg-emerald-500',
  'in-house': 'bg-primary',
  arrivals: 'bg-sky-500',
  departures: 'bg-[var(--brand-orange)]',
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
    <div className="stat-chip surface-card relative min-w-0 flex-1 overflow-hidden px-3.5 py-3 sm:px-4 sm:py-3.5">
      <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${accentBar[accent]}`} />
      <div className="pl-2">
        <p className="text-3xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-4xl">
          {value}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${accentIcon[accent]}`} strokeWidth={2.25} />
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
        {detail && (
          <p className="mt-0.5 truncate pl-5 text-[10px] text-muted-foreground/90">{detail}</p>
        )}
      </div>
    </div>
  )
}

export function DashboardToolbar({ occupancy, today }: DashboardToolbarProps) {
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
          Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-2xl lg:flex-1">
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

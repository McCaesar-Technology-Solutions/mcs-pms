import { LogIn, LogOut, Percent, Users } from 'lucide-react'
import type { OccupancyToday } from '@/lib/data/occupancy'
import type { TodayOperations } from '@/lib/data/overview'

interface DashboardToolbarProps {
  occupancy?: OccupancyToday
  today: TodayOperations
}

function StatChip({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Percent
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="surface-card min-w-0 flex-1 px-3.5 py-2.5 sm:px-4 sm:py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
        <span className="truncate text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">
        {value}
      </p>
      {detail && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{detail}</p>}
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
          icon={Percent}
          label="Occupancy"
          value={occupancy ? `${occupancy.percent}%` : '—'}
          detail={occupancy ? `${occupancy.occupied} of ${occupancy.total} rooms` : undefined}
        />
        <StatChip
          icon={Users}
          label="In house"
          value={String(today.guestsInHouse)}
          detail="Guests checked in"
        />
        <StatChip
          icon={LogIn}
          label="Arrivals"
          value={String(today.arrivalsToday)}
          detail="Checking in today"
        />
        <StatChip
          icon={LogOut}
          label="Departures"
          value={String(today.departuresToday)}
          detail="Checking out today"
        />
      </div>
    </header>
  )
}

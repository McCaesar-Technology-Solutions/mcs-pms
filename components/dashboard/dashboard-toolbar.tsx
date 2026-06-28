import { LogIn, LogOut, Percent, Users } from 'lucide-react'
import { OpsDateSelector } from '@/components/dashboard/ops-date-selector'
import { formatOpsDateLabel, isOpsDateToday } from '@/lib/dates/ops-date'
import type { OccupancyToday } from '@/lib/data/occupancy'
import type { TodayOperations } from '@/lib/data/overview'

interface DashboardToolbarProps {
  occupancy?: OccupancyToday
  today: TodayOperations
  title?: string
  eyebrow?: string
  opsDate?: string
  showOpsDateSelector?: boolean
}

function StatChip({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  accent = 'gold',
  emphasis = false,
}: {
  icon: typeof Percent
  label: string
  value: string
  detail?: string
  progress?: number
  accent?: 'gold' | 'teal' | 'sky' | 'coral'
  emphasis?: boolean
}) {
  return (
    <div
      className={`stat-chip stat-chip--light stat-chip--tone-${accent} min-w-0 flex-1 ${
        emphasis ? 'stat-chip--emphasis' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`stat-chip__icon-badge stat-chip__icon-badge--${accent}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="stat-chip__label">{label}</span>
      </div>
      <p className="stat-chip__value">{value}</p>
      {progress != null && (
        <div className="stat-chip__progress-track">
          <div
            className={`stat-chip__progress--${accent} h-full rounded-full transition-[width] duration-500`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {detail && <p className="stat-chip__detail">{detail}</p>}
    </div>
  )
}

export function DashboardToolbar({
  occupancy,
  today,
  title = 'Dashboard',
  eyebrow = 'Today',
  opsDate,
  showOpsDateSelector = false,
}: DashboardToolbarProps) {
  const activeDate = opsDate ?? new Date().toISOString().slice(0, 10)
  const dateLabel = formatOpsDateLabel(activeDate)
  const eyebrowLabel = isOpsDateToday(activeDate) ? eyebrow : formatOpsDateLabel(activeDate)

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="label-eyebrow label-eyebrow-accent">{eyebrowLabel}</p>
          <h1 className="font-display mt-1 text-[1.625rem] font-semibold tracking-tight text-foreground text-balance sm:text-[1.875rem]">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateLabel}</p>
        </div>

        {showOpsDateSelector && (
          <OpsDateSelector opsDate={activeDate} className="lg:max-w-sm lg:flex-1" />
        )}

        <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-4 lg:max-w-[40rem] lg:flex-1">
          <StatChip
            icon={Percent}
            label="Occupancy"
            value={occupancy ? `${occupancy.percent}%` : '—'}
            detail={occupancy ? `${occupancy.occupied} of ${occupancy.total} rooms` : undefined}
            progress={occupancy?.percent}
            accent="gold"
            emphasis
          />
          <StatChip
            icon={Users}
            label="In house"
            value={String(today.guestsInHouse)}
            detail="Guests checked in"
            accent="teal"
          />
          <StatChip
            icon={LogIn}
            label="Arrivals"
            value={String(today.arrivalsToday)}
            detail="Checking in today"
            accent="sky"
          />
          <StatChip
            icon={LogOut}
            label="Departures"
            value={String(today.departuresToday)}
            detail="Checking out today"
            accent="coral"
          />
        </div>
      </div>
    </header>
  )
}

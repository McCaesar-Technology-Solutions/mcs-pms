import Link from 'next/link'
import { GuestDndBadge } from '@/components/ui/guest-dnd-badge'
import type { Reservation } from '@/types'

interface TodayGuestStripProps {
  arrivals: Reservation[]
  departures: Reservation[]
  reservationsHref: string
}

function GuestCard({
  reservation,
  kind,
  href,
}: {
  reservation: Reservation
  kind: 'arrival' | 'departure'
  href: string
}) {
  const initial = reservation.guestName.trim().charAt(0).toUpperCase() || '?'
  const date =
    kind === 'arrival' ? reservation.checkInDate : reservation.checkOutDate
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <Link
      href={`${href}?open=${reservation.id}`}
      className="today-guest-card shrink-0"
    >
      <div className="flex items-center gap-3">
        <div
          className={`today-guest-card__avatar today-guest-card__avatar--${
            kind === 'arrival' ? 'arrival' : 'departure'
          }`}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
            {reservation.guestName}
            {reservation.guestDoNotDisturb && <GuestDndBadge compact />}
          </p>
          <p className="text-xs text-muted-foreground">
            Room {reservation.roomNumber} · {kind === 'arrival' ? 'Arriving' : 'Departing'} {dateLabel}
          </p>
        </div>
      </div>
      <span className={`status-pill status-pill--${kind === 'arrival' ? 'info' : 'warm'}`}>
        {kind === 'arrival' ? 'Arrival' : 'Departure'}
      </span>
    </Link>
  )
}

export function TodayGuestStrip({ arrivals, departures, reservationsHref }: TodayGuestStripProps) {
  const items = [
    ...arrivals.map((r) => ({ reservation: r, kind: 'arrival' as const })),
    ...departures.map((r) => ({ reservation: r, kind: 'departure' as const })),
  ]

  if (items.length === 0) {
    return (
      <div className="surface-card-section--muted text-sm text-muted-foreground">
        No arrivals or departures scheduled for today.
      </div>
    )
  }

  return (
    <div className="today-guest-strip">
      <p className="mb-3 px-1 text-xs text-muted-foreground">
        {arrivals.length} arrival{arrivals.length === 1 ? '' : 's'} ·{' '}
        {departures.length} departure{departures.length === 1 ? '' : 's'}
      </p>
      <div className="today-guest-strip__scroll">
        {items.map(({ reservation, kind }) => (
          <GuestCard
            key={`${kind}-${reservation.id}`}
            reservation={reservation}
            kind={kind}
            href={reservationsHref}
          />
        ))}
      </div>
    </div>
  )
}

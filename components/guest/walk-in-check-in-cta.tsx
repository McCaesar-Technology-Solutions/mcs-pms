import Link from 'next/link'
import { LogIn } from 'lucide-react'

interface WalkInCheckInCtaProps {
  reservationsHref: string
}

export function WalkInCheckInCta({ reservationsHref }: WalkInCheckInCtaProps) {
  const href = `${reservationsHref}${reservationsHref.includes('?') ? '&' : '?'}checkIn=1`

  return (
    <div className="surface-card p-5">
      <div className="surface-card-accent" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Walk-in check-in</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Book the stay, check the guest in, and share the portal link — all from Reservations.
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl bg-[#D4A62E] px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-elevation-1 transition-all hover:-translate-y-px hover:shadow-elevation-2"
        >
          <LogIn className="h-4 w-4" />
          Check in now
        </Link>
      </div>
    </div>
  )
}

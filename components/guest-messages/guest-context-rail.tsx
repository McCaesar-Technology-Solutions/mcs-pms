'use client'

import Link from 'next/link'
import { CalendarDays, CreditCard, Mail, Phone, User } from 'lucide-react'
import type { GuestConversationContext } from '@/lib/data/guest-conversation-context'

interface GuestContextRailProps {
  context: GuestConversationContext
  reservationsHref: string
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value + (value.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function statusLabel(status: string | null) {
  if (!status) return null
  return status.replace(/_/g, ' ')
}

export function GuestContextRail({ context, reservationsHref }: GuestContextRailProps) {
  return (
    <aside className="staff-messenger__context-rail" aria-label="Guest details">
      <h2 className="staff-messenger__context-title">Guest context</h2>

      <div className="staff-messenger__context-block">
        <div className="staff-messenger__context-row">
          <User className="h-4 w-4 shrink-0 text-[var(--brand-purple)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{context.guestName}</p>
            {context.roomNumber && (
              <p className="text-xs text-muted-foreground">Room {context.roomNumber}</p>
            )}
          </div>
        </div>

        {context.guestPhone && (
          <div className="staff-messenger__context-row">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <a href={`tel:${context.guestPhone}`} className="text-sm text-foreground hover:underline">
              {context.guestPhone}
            </a>
          </div>
        )}

        {context.guestEmail && (
          <div className="staff-messenger__context-row">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <a href={`mailto:${context.guestEmail}`} className="truncate text-sm text-foreground hover:underline">
              {context.guestEmail}
            </a>
          </div>
        )}
      </div>

      {(context.checkInDate || context.checkOutDate) && (
        <div className="staff-messenger__context-block">
          <div className="staff-messenger__context-row">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stay</p>
              <p className="text-sm text-foreground">
                {formatDate(context.checkInDate) ?? 'TBD'} - {formatDate(context.checkOutDate) ?? 'TBD'}
              </p>
              {context.reservationStatus && (
                <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                  {statusLabel(context.reservationStatus)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {context.paymentStatus && (
        <div className="staff-messenger__context-block">
          <div className="staff-messenger__context-row">
            <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Payment</p>
              <p className="text-sm capitalize text-foreground">{statusLabel(context.paymentStatus)}</p>
            </div>
          </div>
        </div>
      )}

      {context.reservationId && (
        <Link href={`${reservationsHref}?open=${context.reservationId}`} className="staff-messenger__context-link">
          Open reservation
        </Link>
      )}
    </aside>
  )
}

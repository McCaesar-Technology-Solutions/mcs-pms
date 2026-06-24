'use client'

import { Star } from 'lucide-react'
import type { GuestFeedbackSummary } from '@/lib/data/guest-feedback'

interface GuestFeedbackPanelProps {
  summary: GuestFeedbackSummary
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${
            n <= rating ? 'fill-[#D4A62E] text-[#D4A62E]' : 'text-muted-foreground/25'
          }`}
        />
      ))}
    </span>
  )
}

export function GuestFeedbackPanel({ summary }: GuestFeedbackPanelProps) {
  return (
    <div id="guest-feedback" className="surface-card overflow-hidden scroll-mt-24">
      <div className="surface-card-accent" />
      <div className="surface-card-header">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Guest reviews</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Feedback from the guest portal · You tab
            </p>
          </div>
          {summary.totalCount > 0 && (
            <div className="flex gap-4 text-sm">
              {summary.averageRating != null && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#3C216C]">{summary.averageRating}</p>
                  <p className="text-xs text-muted-foreground">Avg (recent)</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">{summary.totalCount}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              {summary.lowRatingCount > 0 && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#D85A30]">{summary.lowRatingCount}</p>
                  <p className="text-xs text-muted-foreground">≤ 2 stars</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {summary.totalCount === 0 ? (
        <p className="border-t border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          No guest reviews yet. Reviews appear here after guests submit feedback on the You tab.
        </p>
      ) : (
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {summary.rows.map((row) => (
          <li key={row.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{row.guestName}</p>
                  {row.roomNumber && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Room {row.roomNumber}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Stars rating={row.rating} />
                  <span className="text-xs text-muted-foreground">{row.rating}/5</span>
                </div>
                {row.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{row.comment}</p>
                )}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { runNightAudit } from '@/app/actions/night-audit'
import { TablePagination } from '@/components/dashboard/table-pagination'
import { usePagination } from '@/lib/hooks/use-pagination'

interface NightAuditRow {
  id: string
  business_date: string
  rooms_occupied: number
  rooms_available: number
  arrivals: number
  departures: number
  revenue_posted: number
  notes: string | null
  closed_at: string | null
}

interface NightAuditPanelProps {
  audits: NightAuditRow[]
  todayClosed: boolean
}

function money(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: string) {
  return new Date(value + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function NightAuditPanel({ audits, todayClosed }: NightAuditPanelProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()
  const pagination = usePagination(audits, 7)

  function closeAudit() {
    startTransition(async () => {
      const result = await runNightAudit(notes || undefined)
      if (result.success) {
        toast.success('Night audit closed for today')
        setNotes('')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const latest = audits[0]

  return (
    <div className="surface-card overflow-hidden">
      <div className="surface-card-accent" />
      <div className="surface-card-header space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-[var(--brand-gold-light)]" />
              <h3 className="text-lg font-semibold">Night audit</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              End-of-day close: occupancy, arrivals, departures, and revenue posted.
            </p>
          </div>
          {todayClosed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(var(--glow-gold),0.14)] px-3 py-1 text-xs font-semibold text-[var(--brand-gold-dark)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Today closed
            </span>
          )}
        </div>

        {!todayClosed && (
          <div className="space-y-3 rounded-xl surface-inset p-4">
            <label className="text-sm font-semibold">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[rgba(var(--glow-purple),0.12)] bg-background px-3 py-2 text-sm"
              placeholder="Variance notes, late check-outs, etc."
            />
            <button
              type="button"
              disabled={pending}
              onClick={closeAudit}
              className="rounded-lg bg-[var(--brand-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-purple-ink)] transition hover:bg-[var(--brand-gold-light)] disabled:opacity-50"
            >
              {pending ? 'Closing…' : 'Run night audit'}
            </button>
          </div>
        )}

        {latest && (
          <div className="night-audit-stats">
            <Stat label="Occupied" value={String(latest.rooms_occupied)} />
            <Stat label="Available" value={String(latest.rooms_available)} />
            <Stat label="Arrivals" value={String(latest.arrivals)} />
            <Stat label="Departures" value={String(latest.departures)} />
          </div>
        )}
      </div>

      {audits.length > 0 ? (
        <>
          <div className="data-table-wrap overflow-x-auto px-4 sm:px-6">
            <table className="data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Business date</th>
                  <th className="text-left">Occupied</th>
                  <th className="text-left">Arrivals</th>
                  <th className="text-left">Departures</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <p className="font-semibold text-foreground">{formatDate(row.business_date)}</p>
                      {row.notes && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                          {row.notes}
                        </p>
                      )}
                    </td>
                    <td className="tabular-nums">{row.rooms_occupied}</td>
                    <td className="tabular-nums">{row.arrivals}</td>
                    <td className="tabular-nums">{row.departures}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {money(Number(row.revenue_posted))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            rangeStart={pagination.rangeStart}
            rangeEnd={pagination.rangeEnd}
            onPageChange={pagination.setPage}
          />
        </>
      ) : (
        <p className="px-6 py-8 text-center text-sm text-muted-foreground">
          No night audits recorded yet. Run your first close above.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="night-audit-stat">
      <p className="night-audit-stat__label">{label}</p>
      <p className="night-audit-stat__value">{value}</p>
    </div>
  )
}

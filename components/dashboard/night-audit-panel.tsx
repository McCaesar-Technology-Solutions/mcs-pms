'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { runNightAudit } from '@/app/actions/night-audit'

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

export function NightAuditPanel({ audits, todayClosed }: NightAuditPanelProps) {
  const router = useRouter()
  const [notes, setNotes] = useState('')
  const [pending, startTransition] = useTransition()

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
    <div className="surface-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-[var(--brand-gold-light)]" />
            <h3 className="text-lg font-semibold">Night audit</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            End-of-day close: occupancy, arrivals, departures, and revenue posted today.
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
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <Stat label="Occupied" value={String(latest.rooms_occupied)} />
          <Stat label="Available" value={String(latest.rooms_available)} />
          <Stat label="Arrivals" value={String(latest.arrivals)} />
          <Stat label="Departures" value={String(latest.departures)} />
        </div>
      )}

      {audits.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Occupied</th>
                <th className="py-2 pr-4">Arrivals</th>
                <th className="py-2 pr-4">Departures</th>
                <th className="py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {audits.slice(0, 7).map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium">{row.business_date}</td>
                  <td className="py-2 pr-4">{row.rooms_occupied}</td>
                  <td className="py-2 pr-4">{row.arrivals}</td>
                  <td className="py-2 pr-4">{row.departures}</td>
                  <td className="py-2">{money(Number(row.revenue_posted))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl surface-inset p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  )
}

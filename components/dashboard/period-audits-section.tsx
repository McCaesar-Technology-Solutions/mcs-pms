'use client'

import { useState } from 'react'
import { NightAuditPanel } from '@/components/dashboard/night-audit-panel'
import { PeriodAuditPanel } from '@/components/dashboard/period-audit-panel'
import type { PeriodAuditRow } from '@/app/actions/period-audit'
import { runMonthlyAudit, runYearlyAudit } from '@/app/actions/period-audit'

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

type AuditTab = 'night' | 'monthly' | 'yearly'

interface PeriodAuditsSectionProps {
  nightAudits: NightAuditRow[]
  monthlyAudits: PeriodAuditRow[]
  yearlyAudits: PeriodAuditRow[]
  todayClosed: boolean
  monthClosed: boolean
  yearClosed: boolean
}

const TABS: { id: AuditTab; label: string }[] = [
  { id: 'night', label: 'Night' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
]

export function PeriodAuditsSection({
  nightAudits,
  monthlyAudits,
  yearlyAudits,
  todayClosed,
  monthClosed,
  yearClosed,
}: PeriodAuditsSectionProps) {
  const [tab, setTab] = useState<AuditTab>('night')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? 'rounded-full bg-[var(--brand-purple)] px-4 py-2 text-sm font-semibold text-white'
                : 'rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'night' && <NightAuditPanel audits={nightAudits} todayClosed={todayClosed} />}
      {tab === 'monthly' && (
        <PeriodAuditPanel
          type="monthly"
          audits={monthlyAudits}
          periodClosed={monthClosed}
          onRun={async (notes) => {
            const result = await runMonthlyAudit(notes)
            return { success: result.success, error: result.success ? undefined : result.error }
          }}
        />
      )}
      {tab === 'yearly' && (
        <PeriodAuditPanel
          type="yearly"
          audits={yearlyAudits}
          periodClosed={yearClosed}
          onRun={async (notes) => {
            const result = await runYearlyAudit(notes)
            return { success: result.success, error: result.success ? undefined : result.error }
          }}
        />
      )}
    </div>
  )
}

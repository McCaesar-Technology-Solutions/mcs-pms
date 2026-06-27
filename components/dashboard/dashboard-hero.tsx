import type { ReactNode } from 'react'
import { DarkSection } from '@/components/dashboard/dark-section'

interface DashboardHeroProps {
  children: ReactNode
}

/** Full-bleed dark ops band — toolbar + attention for role dashboards. */
export function DashboardHero({ children }: DashboardHeroProps) {
  return (
    <div className="page-header-bleed">
      <DarkSection variant="ops" className="dashboard-ops-hero">
        <div className="space-y-5">{children}</div>
      </DarkSection>
    </div>
  )
}

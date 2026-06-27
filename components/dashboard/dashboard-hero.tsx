import type { ReactNode } from 'react'

interface DashboardHeroProps {
  children: ReactNode
}

/** Unified light header block for dashboards — toolbar + attention in one surface. */
export function DashboardHero({ children }: DashboardHeroProps) {
  return <div className="dashboard-hero surface-card">{children}</div>
}

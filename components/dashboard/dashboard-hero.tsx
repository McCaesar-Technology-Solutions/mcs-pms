import type { ReactNode } from 'react'

interface DashboardHeroProps {
  children: ReactNode
}

/** Light header band — today's ops without dominating the page. */
export function DashboardHero({ children }: DashboardHeroProps) {
  return (
    <div className="page-header-bleed">
      <section className="dashboard-header-band" aria-label="Dashboard summary">
        <div className="page-shell dashboard-header-band__inner">
          <div className="space-y-4">{children}</div>
        </div>
      </section>
    </div>
  )
}
